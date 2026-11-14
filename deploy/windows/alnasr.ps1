[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("prepare", "setup", "build", "start", "stop", "restart", "status", "open", "init", "backup", "restore", "export-cert")]
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
        $contents = "DB_PASSWORD=$secret" + $newline + "SITE_NAME=alnasr.local" + $newline + "BIND_ADDRESS=127.0.0.1" + $newline + "HTTP_PUBLISH_PORT=8080" + $newline + "LAN_BIND_ADDRESS=127.0.0.1" + $newline
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
    "export-cert" {
        Ensure-LocalEnv
        Invoke-Compose up -d caddy
        if ($LASTEXITCODE -ne 0) { throw "Caddy HTTPS gateway did not start." }
        Start-Sleep -Seconds 5
        Invoke-Compose cp "caddy:/data/caddy/pki/authorities/local/root.crt" (Join-Path $DataRoot "alnasr-local-root.crt")
        if ($LASTEXITCODE -ne 0) { throw "Could not export the local CA certificate." }
        Write-Host "Local CA exported to $DataRoot. Install it on the Android phone as a CA certificate."
    }
    "restore" {
        Ensure-LocalEnv
        if (-not (Test-Path $BackupDir)) { throw "No local backup directory exists at $BackupDir." }
        $backups = @(Get-ChildItem -Path $BackupDir -Filter "*-database.sql.gz" -File | Sort-Object LastWriteTime -Descending)
        if ($backups.Count -eq 0) { throw "No database backups were found in $BackupDir." }
        for ($index = 0; $index -lt $backups.Count; $index++) { Write-Host "[$index] $($backups[$index].Name)" }
        $selection = Read-Host "Enter the backup number to restore"
        $number = 0
        if (-not [int]::TryParse($selection, [ref]$number) -or $number -lt 0 -or $number -ge $backups.Count) { throw "Invalid backup selection." }
        $sql = $backups[$number]
        $suffix = "-database.sql.gz"
        $prefix = $sql.Name.Substring(0, $sql.Name.Length - $suffix.Length)
        $publicFile = Join-Path $BackupDir ($prefix + "-files.tar")
        $privateFile = Join-Path $BackupDir ($prefix + "-private-files.tar")
        if (-not (Test-Path $publicFile) -or -not (Test-Path $privateFile)) { throw "Selected backup is incomplete." }
        $confirm = Read-Host "This replaces current data. Type RESTORE to continue"
        if ($confirm -cne "RESTORE") { throw "Restore cancelled." }
        & $PSCommandPath -Action backup
        if (-not $?) { throw "Pre-restore safety backup failed." }
        Invoke-Compose cp $sql.FullName "backend:/tmp/alnasr-restore-database.sql.gz"
        Invoke-Compose cp $publicFile "backend:/tmp/alnasr-restore-public-files.tar"
        Invoke-Compose cp $privateFile "backend:/tmp/alnasr-restore-private-files.tar"
        $dbLine = Get-Content $EnvFile | Where-Object { $_.StartsWith("DB_PASSWORD=") } | Select-Object -First 1
        if (-not $dbLine) { throw "Database password is missing." }
        $dbPassword = $dbLine.Substring("DB_PASSWORD=".Length)
        $payload = $dbPassword + [Environment]::NewLine
        $payload | docker compose --project-name $ProjectName --env-file $EnvFile -f $Compose exec -T backend bash -lc 'read -r DBROOT; bench --site alnasr.local restore /tmp/alnasr-restore-database.sql.gz --db-root-username root --db-root-password "$DBROOT" --with-public-files /tmp/alnasr-restore-public-files.tar --with-private-files /tmp/alnasr-restore-private-files.tar --force && bench --site alnasr.local migrate'
        if ($LASTEXITCODE -ne 0) { throw "Restore or migration failed. Keep the pre-restore backup." }
        Invoke-Compose restart backend websocket queue-short queue-long scheduler frontend caddy
        if ($LASTEXITCODE -ne 0) { throw "Services could not restart after restore." }
        $health = Invoke-WebRequest -Uri "http://127.0.0.1:8080/api/method/ping" -TimeoutSec 30
        if ($health.StatusCode -ne 200 -or $health.Content -notmatch "pong") { throw "Post-restore health check failed." }
        Write-Host "Restore and HTTP health check completed. Verify stock, invoices, payments, and GL before resuming sales."
    }
    "backup" {
        New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
        Invoke-Compose exec -T backend bench --site $SiteName backup --with-files
        if ($LASTEXITCODE -ne 0) { throw "Bench backup failed." }
        Invoke-Compose cp "backend:/home/frappe/frappe-bench/sites/$SiteName/private/backups/." $BackupDir
        Write-Host "Backup files copied to $BackupDir. Verify a restore on a separate test site before relying on this backup."
    }
}
