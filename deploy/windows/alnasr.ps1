[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("start", "stop", "restart", "status", "open", "init", "backup")]
    [string]$Action
)
$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$Deploy = Join-Path $Root "deploy"
$Compose = Join-Path $Deploy "compose.yaml"
$EnvFile = Join-Path $Deploy ".env"
$SiteName = "alnasr.local"

function Invoke-Compose {
    if (-not (Test-Path $EnvFile)) {
        throw "Missing deploy/.env. Copy deploy/.env.example to deploy/.env and set a strong DB_PASSWORD."
    }
    docker compose --env-file $EnvFile -f $Compose @args
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose failed with exit code $LASTEXITCODE." }
}
function Assert-Docker {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw "Docker CLI is missing. Install Docker Desktop with WSL2 first." }
    docker info *> $null
    if ($LASTEXITCODE -ne 0) { throw "Docker Desktop Linux engine is not running." }
    docker compose version *> $null
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose v2 is required." }
}
Assert-Docker
switch ($Action) {
    "start" { Invoke-Compose up -d; Write-Host "Containers started. Check status and initialize the site if this is the first run." }
    "stop" { Invoke-Compose stop; Write-Host "Services stopped; persistent data volumes retained." }
    "restart" { Invoke-Compose restart; Write-Host "Services restarted." }
    "status" {
        Invoke-Compose ps
        try { $response = Invoke-WebRequest -Uri "http://127.0.0.1:8080/api/method/ping" -TimeoutSec 5; Write-Host "HTTP health: $($response.StatusCode)" }
        catch { Write-Warning "HTTP health did not pass. Inspect container logs." }
    }
    "open" { Start-Process "http://127.0.0.1:8080" }
    "init" {
        Invoke-Compose up -d db redis-cache redis-queue
        $match = Select-String -Path $EnvFile -Pattern '^DB_PASSWORD=(.+)$'
        $dbPassword = if ($match) { $match.Matches[0].Groups[1].Value } else { "" }
        if (-not $dbPassword -or $dbPassword -eq "REPLACE_WITH_A_LONG_RANDOM_SECRET") { throw "Set a strong DB_PASSWORD in deploy/.env first." }
        $secure = Read-Host "Create the AL-NASR Administrator password" -AsSecureString
        $adminPassword = [System.Net.NetworkCredential]::new("", $secure).Password
        if ($adminPassword.Length -lt 12) { throw "Administrator password must be at least 12 characters." }
        $payload = $dbPassword + [Environment]::NewLine + $adminPassword + [Environment]::NewLine
        $payload | docker compose --env-file $EnvFile -f $Compose run --rm -T --no-deps --entrypoint bash backend -lc 'read -r DBROOT; read -r ADMIN; bench new-site alnasr.local --db-host db --db-root-username root --db-root-password "$DBROOT" --admin-password "$ADMIN" --install-app erpnext --install-app alnasr --set-default'
        if ($LASTEXITCODE -ne 0) { throw "Site creation failed. Inspect logs before retrying." }
        Invoke-Compose up -d
        Write-Host "Initial site created. Open http://127.0.0.1:8080; login user is Administrator."
    }
    "backup" {
        $backupDir = Join-Path $Deploy "backups"
        New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
        Invoke-Compose exec -T backend bench --site $SiteName backup --with-files --backup-path /home/frappe/frappe-bench/sites/$SiteName/private/backups
        if ($LASTEXITCODE -ne 0) { throw "Bench backup failed." }
        Invoke-Compose cp "backend:/home/frappe/frappe-bench/sites/$SiteName/private/backups/." $backupDir
        Write-Host "Backup files copied to $backupDir. Restore remains gated on a verified restore test."
    }
}
