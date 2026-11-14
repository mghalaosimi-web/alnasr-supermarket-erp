[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("prepare", "setup", "build", "start", "stop", "restart", "status", "open", "init", "backup")]
    [string]$Action
)
$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$Deploy = Join-Path $Root "deploy"
$Compose = Join-Path $Deploy "compose.yaml"
$DataRoot = Join-Path $env:LOCALAPPDATA "AL-NASR ERP"
$EnvFile = Join-Path $DataRoot ".env"
$BackupDir = Join-Path $DataRoot "Backups"
$SiteName = "alnasr.local"
$ProjectName = "alnasr"

function Invoke-Compose {
    if (-not (Test-Path $EnvFile)) {
        throw "Missing deploy/.env. Copy deploy/.env.example to deploy/.env and set a strong DB_PASSWORD."
    }
    docker compose --project-name $ProjectName --env-file $EnvFile -f $Compose @args
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose failed with exit code $LASTEXITCODE." }
}
function Assert-Docker {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw "Docker CLI is missing. Install Docker Desktop with WSL2 first." }
    docker info *> $null
    if ($LASTEXITCODE -ne 0) { throw "Docker Desktop Linux engine is not running." }
    docker compose version *> $null
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose v2 is required." }
}
function Ensure-LocalEnv {
    New-Item -ItemType Directory -Force -Path $DataRoot | Out-Null
    if (-not (Test-Path $EnvFile)) {
        $bytes = New-Object byte[] 48
        $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
        $secret = [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
        $newline = [Environment]::NewLine
        $contents = "DB_PASSWORD=$secret" + $newline + "SITE_NAME=alnasr.local" + $newline + "BIND_ADDRESS=127.0.0.1" + $newline + "HTTP_PUBLISH_PORT=8080" + $newline
        [System.IO.File]::WriteAllText($EnvFile, $contents, (New-Object System.Text.UTF8Encoding($false)))
        $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
        $acl = New-Object System.Security.AccessControl.FileSecurity
        $acl.SetAccessRuleProtection($true, $false)
        $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($identity, "Read,Write", "Allow")
        $acl.SetAccessRule($rule)
        Set-Acl -Path $EnvFile -AclObject $acl
        Write-Host "Created a private local database secret at $EnvFile"
    }
}
if ($Action -ne "prepare") { Assert-Docker }
switch ($Action) {
    "prepare" {
        Ensure-LocalEnv
        Write-Host "Local configuration prepared. No cloud service or paid resource is required."
    }
    "setup" {
        Ensure-LocalEnv
        & $PSCommandPath -Action init
        if (-not $?) { throw "First-run setup failed." }
        Start-Process "http://127.0.0.1:8080"
    }
    "build" {
        docker build --file (Join-Path $Deploy "Dockerfile") --tag alnasr-local:16 $Root
        if ($LASTEXITCODE -ne 0) { throw "AL-NASR image build failed." }
        Write-Host "AL-NASR runtime image built locally."
    }
    "start" {
        $image = docker image inspect alnasr-local:16 2>$null
        if ($LASTEXITCODE -ne 0) { throw "Runtime image is missing. Run this script with -Action build first." }
        Invoke-Compose up -d
        Write-Host "Containers started. Initialize the site on first use with -Action init."
    }
    "stop" { Invoke-Compose stop; Write-Host "Services stopped; persistent data volumes retained." }
    "restart" { Invoke-Compose restart; Write-Host "Services restarted." }
    "status" {
        Invoke-Compose ps
        try { $response = Invoke-WebRequest -Uri "http://127.0.0.1:8080/api/method/ping" -TimeoutSec 5; Write-Host "HTTP health: $($response.StatusCode)" }
        catch { Write-Warning "HTTP health did not pass. Inspect container logs." }
    }
    "open" { Start-Process "http://127.0.0.1:8080" }
    "init" {
        Ensure-LocalEnv
        docker build --file (Join-Path $Deploy "Dockerfile") --tag alnasr-local:16 $Root
        if ($LASTEXITCODE -ne 0) { throw "AL-NASR image build failed." }
        Invoke-Compose run --rm configurator
        if ($LASTEXITCODE -ne 0) { throw "Runtime configurator failed." }
        $match = Select-String -Path $EnvFile -Pattern '^DB_PASSWORD=(.+)$'
        $dbPassword = if ($match) { $match.Matches[0].Groups[1].Value } else { "" }
        if (-not $dbPassword -or $dbPassword -eq "REPLACE_WITH_A_LONG_RANDOM_SECRET") { throw "Set a strong DB_PASSWORD in deploy/.env first." }
        $secure = Read-Host "Create the AL-NASR Administrator password" -AsSecureString
        $adminPassword = [System.Net.NetworkCredential]::new("", $secure).Password
        if ($adminPassword.Length -lt 12) { throw "Administrator password must be at least 12 characters." }
        $payload = $dbPassword + [Environment]::NewLine + $adminPassword + [Environment]::NewLine
        $payload | docker compose --project-name $ProjectName --env-file $EnvFile -f $Compose run --rm -T --no-deps --entrypoint bash backend -lc 'read -r DBROOT; read -r ADMIN; bench new-site alnasr.local --db-host db --mariadb-user-host-login-scope % --db-root-username root --db-root-password "$DBROOT" --admin-password "$ADMIN" --install-app erpnext --install-app xpos --install-app alnasr --set-default'
        if ($LASTEXITCODE -ne 0) { throw "Site creation failed. Inspect logs before retrying." }
        Invoke-Compose up -d
        Write-Host "Initial site created. Open http://127.0.0.1:8080; login user is Administrator."
    }
    "backup" {
        New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
        Invoke-Compose exec -T backend bench --site $SiteName backup --with-files
        if ($LASTEXITCODE -ne 0) { throw "Bench backup failed." }
        Invoke-Compose cp "backend:/home/frappe/frappe-bench/sites/$SiteName/private/backups/." $BackupDir
        Write-Host "Backup files copied to $BackupDir. Verify a restore on a separate test site before relying on this backup."
    }
}
