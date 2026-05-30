param(
  [ValidateSet("fire-up", "status", "stop", "install-command")]
  [string]$Command = "status"
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$Logs = Join-Path $Root "logs"
$PidFile = Join-Path $Logs "pids.txt"
$ApiDir = Join-Path $Root "apps\api"
$FrontendDir = Join-Path $Root "apps\frontend"
$MlDir = Join-Path $Root "apps\ml-service"

function Read-DotEnv($Path) {
  $values = @{}
  if (-not (Test-Path $Path)) {
    return $values
  }

  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if ($line.Length -eq 0 -or $line.StartsWith("#") -or -not $line.Contains("=")) {
      return
    }

    $equalsAt = $line.IndexOf("=")
    $name = $line.Substring(0, $equalsAt)
    $value = $line.Substring($equalsAt + 1)
    $values[$name.Trim()] = $value.Trim()
  }

  return $values
}

function Get-Setting($Primary, $Secondary, $Name, $Fallback) {
  if ($Primary.ContainsKey($Name) -and $Primary[$Name]) {
    return $Primary[$Name]
  }
  if ($Secondary.ContainsKey($Name) -and $Secondary[$Name]) {
    return $Secondary[$Name]
  }
  return $Fallback
}

function Quote-Pwsh($Value) {
  return "'" + ($Value -replace "'", "''") + "'"
}

function Ensure-EnvFiles {
  $pairs = @(
    @{ Example = Join-Path $Root ".env.example"; Target = Join-Path $Root ".env" },
    @{ Example = Join-Path $ApiDir ".env.example"; Target = Join-Path $ApiDir ".env" },
    @{ Example = Join-Path $FrontendDir ".env.example"; Target = Join-Path $FrontendDir ".env" }
  )

  foreach ($pair in $pairs) {
    if (-not (Test-Path $pair.Target) -and (Test-Path $pair.Example)) {
      Copy-Item -LiteralPath $pair.Example -Destination $pair.Target
      Write-Host "Created $($pair.Target)"
    }
  }
}

function Test-Http($Url) {
  try {
    $response = Invoke-WebRequest -Uri $Url -TimeoutSec 3 -UseBasicParsing
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

function Wait-Http($Url, $Name, $Seconds = 45) {
  for ($i = 0; $i -lt $Seconds; $i++) {
    if (Test-Http $Url) {
      Write-Host "$Name is ready: $Url"
      return
    }
    Start-Sleep -Seconds 1
  }

  throw "$Name did not become ready at $Url. Check logs in $Logs."
}

function Get-PortOwner($Port) {
  Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty OwningProcess
}

function Start-LoggedProcess($Name, $WorkingDirectory, $CommandText, $LogName) {
  New-Item -ItemType Directory -Force -Path $Logs | Out-Null

  $logPath = Join-Path $Logs $LogName
  $fullCommand = "Set-Location -LiteralPath $(Quote-Pwsh $WorkingDirectory); $CommandText *> $(Quote-Pwsh $logPath)"

  $process = Start-Process `
    -FilePath "powershell.exe" `
    -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $fullCommand) `
    -WindowStyle Hidden `
    -PassThru

  "$Name=$($process.Id)" | Add-Content -LiteralPath $PidFile
  Write-Host "Started $Name wrapper process $($process.Id). Log: $logPath"
}

function Invoke-Checked($Name, $WorkingDirectory, $CommandText) {
  Write-Host $Name
  Push-Location $WorkingDirectory
  try {
    powershell.exe -NoProfile -ExecutionPolicy Bypass -Command $CommandText
    if ($LASTEXITCODE -ne 0) {
      throw "$Name failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
}

function Ensure-NodeModules {
  if (-not (Test-Path (Join-Path $ApiDir "node_modules"))) {
    Invoke-Checked "Installing API dependencies..." $ApiDir "npm install --no-audit --no-fund"
  }

  if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) {
    Invoke-Checked "Installing frontend dependencies..." $FrontendDir "npm install --no-audit --no-fund"
  }
}

function Ensure-PythonDeps {
  $check = "import fastapi, pandas, numpy, sklearn, joblib"
  Push-Location $MlDir
  try {
    python -c $check 2>$null
    if ($LASTEXITCODE -ne 0) {
      Write-Host "Installing ML service dependencies..."
      pip install -r requirements.txt
    }
  } finally {
    Pop-Location
  }
}

function Ensure-Database {
  Write-Host "Starting PostgreSQL..."
  Push-Location $Root
  try {
    docker compose up -d postgres
    if ($LASTEXITCODE -ne 0) {
      throw "Docker Compose could not start PostgreSQL. Is Docker Desktop running?"
    }
  } finally {
    Pop-Location
  }

  Start-Sleep -Seconds 2
}

function Ensure-Prisma {
  Invoke-Checked "Generating Prisma client..." $ApiDir "npm run prisma:generate"

  Push-Location $ApiDir
  try {
    Write-Host "Applying Prisma migrations..."
    npx prisma migrate deploy
    if ($LASTEXITCODE -ne 0) {
      Write-Host "Prisma migrate deploy did not apply cleanly; trying to baseline the existing init migration."
      npx prisma migrate resolve --applied 20260529180000_init
      npx prisma migrate deploy
      if ($LASTEXITCODE -ne 0) {
        throw "Prisma migration failed."
      }
    }

    Write-Host "Seeding demo data..."
    npm run prisma:seed
    if ($LASTEXITCODE -ne 0) {
      throw "Prisma seed failed."
    }
  } finally {
    Pop-Location
  }
}

function Start-MlService($Port) {
  $health = "http://127.0.0.1:$Port/health"
  if (Test-Http $health) {
    Write-Host "ML service already running: $health"
    return
  }

  $owner = Get-PortOwner $Port
  if ($owner) {
    throw "Port $Port is already in use by PID $owner, but $health did not respond."
  }

  Start-LoggedProcess "ml-service" $MlDir "python -m uvicorn main:app --host 127.0.0.1 --port $Port" "ml-service.log"
  Wait-Http $health "ML service"
}

function Start-Api($Port) {
  $health = "http://127.0.0.1:$Port/health"
  if (Test-Http $health) {
    Write-Host "API already running: $health"
    return
  }

  $owner = Get-PortOwner $Port
  if ($owner) {
    throw "Port $Port is already in use by PID $owner, but $health did not respond."
  }

  Invoke-Checked "Building API..." $ApiDir "npm run build"
  Start-LoggedProcess "api" $ApiDir "npm run start" "api.log"
  Wait-Http $health "API"
}

function Start-Frontend($Port) {
  $url = "http://127.0.0.1:$Port"
  if (Test-Http $url) {
    Write-Host "Frontend already running: $url"
    return
  }

  $owner = Get-PortOwner $Port
  if ($owner) {
    throw "Port $Port is already in use by PID $owner, but $url did not respond."
  }

  Start-LoggedProcess "frontend" $FrontendDir "npm run dev -- --host 127.0.0.1 --port $Port" "frontend.log"
  Wait-Http $url "Frontend"
}

function Show-Status($ApiPort, $MlPort, $FrontendPort) {
  Write-Host ""
  Write-Host "TradeMind AI status"
  Write-Host "-------------------"
  Write-Host "Frontend:  http://127.0.0.1:$FrontendPort  $(if (Test-Http "http://127.0.0.1:$FrontendPort") { "OK" } else { "down" })"
  Write-Host "API:       http://127.0.0.1:$ApiPort/health  $(if (Test-Http "http://127.0.0.1:$ApiPort/health") { "OK" } else { "down" })"
  Write-Host "ML:        http://127.0.0.1:$MlPort/health  $(if (Test-Http "http://127.0.0.1:$MlPort/health") { "OK" } else { "down" })"
  Write-Host ""

  Push-Location $Root
  try {
    $composeOutput = docker compose ps 2>&1
    if ($LASTEXITCODE -eq 0) {
      $composeOutput
    } else {
      Write-Host "Docker Compose status unavailable from this shell."
    }
  } catch {
    Write-Host "Docker Compose status unavailable."
  } finally {
    Pop-Location
  }
}

function Stop-Stack($ApiPort, $MlPort, $FrontendPort) {
  Write-Host "Stopping app processes..."
  foreach ($port in @($ApiPort, $MlPort, $FrontendPort)) {
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
      Write-Host "Stopping PID $($_.OwningProcess) on port $port"
      Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }
  }

  if (Test-Path $PidFile) {
    Get-Content $PidFile | ForEach-Object {
      if ($_ -match "=(\d+)$") {
        Stop-Process -Id ([int]$Matches[1]) -Force -ErrorAction SilentlyContinue
      }
    }
    Remove-Item -LiteralPath $PidFile -Force
  }

  Push-Location $Root
  try {
    docker compose stop postgres
    if ($LASTEXITCODE -ne 0) {
      Write-Host "Docker Compose could not stop PostgreSQL from this shell."
    }
  } finally {
    Pop-Location
  }
}

function Install-CommandShim {
  $shimDir = Join-Path $env:APPDATA "npm"
  $shimPath = Join-Path $shimDir "trademind.cmd"
  $target = Join-Path $Root "trademind.cmd"

  New-Item -ItemType Directory -Force -Path $shimDir | Out-Null
  @("@echo off", "call `"$target`" %*") | Set-Content -LiteralPath $shimPath -Encoding ASCII

  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $parts = @()
  if ($userPath) {
    $parts = $userPath -split ";" | Where-Object { $_ -and $_.Trim() }
  }

  if ($parts -notcontains $shimDir) {
    [Environment]::SetEnvironmentVariable("Path", ((@($parts) + $shimDir) -join ";"), "User")
    Write-Host "Added $shimDir to your user PATH."
  }

  if (($env:Path -split ";") -notcontains $shimDir) {
    $env:Path = "$env:Path;$shimDir"
  }

  Write-Host "Installed global command shim: $shimPath"
  Write-Host "You can now run: trademind fire-up"
}

Ensure-EnvFiles
$rootEnv = Read-DotEnv (Join-Path $Root ".env")
$apiEnv = Read-DotEnv (Join-Path $ApiDir ".env")
$frontendEnv = Read-DotEnv (Join-Path $FrontendDir ".env")

$apiPort = [int](Get-Setting $apiEnv $rootEnv "API_PORT" "3000")
$frontendPort = [int](Get-Setting $frontendEnv $rootEnv "FRONTEND_PORT" "5173")
$mlUrl = Get-Setting $apiEnv $rootEnv "ML_SERVICE_URL" "http://127.0.0.1:8000"
$mlPort = [int]([Uri]$mlUrl).Port

switch ($Command) {
  "fire-up" {
    New-Item -ItemType Directory -Force -Path $Logs | Out-Null
    if (Test-Path $PidFile) {
      Remove-Item -LiteralPath $PidFile -Force
    }

    $apiHealth = "http://127.0.0.1:$apiPort/health"
    Ensure-NodeModules
    Ensure-PythonDeps
    Ensure-Database
    if (Test-Http $apiHealth) {
      Write-Host "API is already healthy; skipping Prisma generation and migration."
    } else {
      Ensure-Prisma
    }
    Start-MlService $mlPort
    Start-Api $apiPort
    Start-Frontend $frontendPort
    Show-Status $apiPort $mlPort $frontendPort
    Write-Host ""
    Write-Host "Open the dashboard: http://127.0.0.1:$frontendPort"
  }
  "status" {
    Show-Status $apiPort $mlPort $frontendPort
  }
  "stop" {
    Stop-Stack $apiPort $mlPort $frontendPort
  }
  "install-command" {
    Install-CommandShim
  }
}