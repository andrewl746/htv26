<#
.SYNOPSIS
Starts the whole demo on this laptop (MASTERSPEC 8.1 A13): the API, the AI service and vite preview.

.DESCRIPTION
Run it from anywhere; it works from the repo root. Ctrl+C stops all three.

    powershell -ExecutionPolicy Bypass -File scripts\demo.ps1               # the locked data
    powershell -ExecutionPolicy Bypass -File scripts\demo.ps1 -DemoCache    # SUPLEX_DEMO_CACHE=1: the cached
                                                                            # addresses and Ward 04 come from api\cache\
    ... -Gpkg data\out\suplex_ward04.gpkg                                   # another GeoPackage
    ... -NoBuild                                                            # serve web\dist as it is

  API         uvicorn api.main:app on 127.0.0.1:8000, SUPLEX_DATA_DIR=data\out, SUPLEX_GPKG=-Gpkg (default
              data\out\suplex.gpkg, the citywide file the Hour-24 lock rebuilt). With -DemoCache and no
              GeoPackage it starts cache-only.
  AI service  uvicorn ai.main:app on 127.0.0.1:8001 (GEMINI_API_KEY from .env; without it, cached and plain
              template text only).
  Web         npm run build with VITE_API_BASE=/api (without it the app serves the fixtures), then vite preview
              on 127.0.0.1:4173, which proxies /api to :8000 and /ai to :8001 (web/vite.config.ts).

127.0.0.1 everywhere, never localhost (about 2 s per connection on Windows). Keys in .env that are not set yet
are loaded first; no value is ever printed. Logs go to data\logs\demo\. scripts/demo.sh is the same for bash.
#>
[CmdletBinding()]
param(
    [switch]$DemoCache,
    [string]$Gpkg = "",
    [switch]$NoBuild,
    [string]$Python = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$DataDir = Join-Path $Root "data\out"
$GpkgPath = if ($Gpkg) { [IO.Path]::GetFullPath([IO.Path]::Combine($Root, $Gpkg)) } else { Join-Path $DataDir "suplex.gpkg" }
$LogDir = Join-Path $Root "data\logs\demo"
if (-not $Python) {
    $venv = Join-Path $Root ".venv\Scripts\python.exe"
    $Python = if (Test-Path $venv) { $venv } else { "python" }
}
$ApiUrl = "http://127.0.0.1:8000"
$AiUrl = "http://127.0.0.1:8001"
$WebUrl = "http://127.0.0.1:4173"

$saved = @{}                                          # the environment as it was, restored at the end
function Set-RunEnv([string]$Name, [string]$Value) {
    if (-not $saved.ContainsKey($Name)) { $saved[$Name] = [Environment]::GetEnvironmentVariable($Name) }
    [Environment]::SetEnvironmentVariable($Name, $Value)
}

function Stop-Demo([string]$Message) {
    Write-Host "!! $Message" -ForegroundColor Red
    exit 1
}

function Test-PortFree([int]$Port) {
    try { return -not (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop) } catch { return $true }
}

# Waits until $Url answers 200, or fails when the process exits first or $Seconds pass.
function Wait-Http([string]$Name, [string]$Url, $Proc, [int]$Seconds, [string]$Log) {
    $deadline = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $deadline) {
        if ($Proc.HasExited) { Stop-Demo "$Name exited (code $($Proc.ExitCode)) before it answered; see $Log" }
        try { return Invoke-RestMethod -Uri $Url -TimeoutSec 2 -UseBasicParsing } catch { Start-Sleep -Milliseconds 500 }
    }
    Stop-Demo "$Name did not answer $Url within $Seconds s; see $Log"
}

$procs = @()
Push-Location $Root
try {
    $envFile = Join-Path $Root ".env"
    if (Test-Path $envFile) {
        foreach ($line in Get-Content $envFile) {
            $line = $line.Trim()
            if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) { continue }
            $key, $value = $line.Split("=", 2)
            $key = $key.Trim()
            if ($key -and -not [Environment]::GetEnvironmentVariable($key)) {
                Set-RunEnv $key $value.Trim().Trim('"').Trim("'")
            }
        }
    }
    Set-RunEnv "SUPLEX_DATA_DIR" $DataDir
    Set-RunEnv "SUPLEX_AI_URL" $AiUrl                  # the API's briefing links and /explain hand-off
    Set-RunEnv "SUPLEX_WEB_URL" $WebUrl                # the app links in the AI explanations and briefings (part of the AI cache keys)
    Set-RunEnv "SUPLEX_API_URL" $ApiUrl                # where the AI service reads wards and checks
    Set-RunEnv "SUPLEX_DEMO_CACHE" $(if ($DemoCache) { "1" } else { "" })
    if (Test-Path $GpkgPath) {
        Set-RunEnv "SUPLEX_GPKG" $GpkgPath
    } elseif ($DemoCache) {
        Set-RunEnv "SUPLEX_GPKG" ""
        Write-Host "  note: no GeoPackage at $GpkgPath, so the API starts cache-only" -ForegroundColor Yellow
    } else {
        Stop-Demo "GeoPackage not found: $GpkgPath (-Gpkg to choose, or -DemoCache to run on the cache alone)"
    }

    Write-Host "Suplex demo, $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    Write-Host "  data        $DataDir"
    Write-Host "  GeoPackage  $(if ($env:SUPLEX_GPKG) { $env:SUPLEX_GPKG } else { 'none (cache-only)' })"
    Write-Host "  demo cache  $(if ($DemoCache) { 'on (SUPLEX_DEMO_CACHE=1)' } else { 'off' })"
    Write-Host "  TIGER_DSN   $(if ($env:TIGER_DSN) { 'set' } else { 'not set: the trend comes from the trend cache' })"
    Write-Host "  GEMINI      $(if ($env:GEMINI_API_KEY) { 'key set' } else { 'no key: cached and template text only' })"

    foreach ($port in 8000, 8001, 4173) {
        if (-not (Test-PortFree $port)) { Stop-Demo "port $port is already in use; stop whatever is on it first" }
    }

    $web = Join-Path $Root "web"
    if (-not (Test-Path (Join-Path $web "node_modules\vite\bin\vite.js"))) {
        Stop-Demo "web\node_modules is missing: run npm install in web\ once"
    }
    if (-not $NoBuild) {
        Write-Host "`n== building the web with VITE_API_BASE=/api"
        Set-RunEnv "VITE_API_BASE" "/api"
        Push-Location $web
        try { & npm run build } finally { Pop-Location }
        if ($LASTEXITCODE -ne 0) { Stop-Demo "npm run build failed (exit $LASTEXITCODE)" }
    } elseif (-not (Test-Path (Join-Path $web "dist\index.html"))) {
        Stop-Demo "web\dist is missing: run without -NoBuild"
    }

    New-Item -ItemType Directory -Force $LogDir | Out-Null
    $services = @(
        @{ Name = "API"; File = $Python; Dir = $Root; Log = "api";
           Args = @("-m", "uvicorn", "api.main:app", "--host", "127.0.0.1", "--port", "8000") },
        @{ Name = "AI service"; File = $Python; Dir = $Root; Log = "ai";
           Args = @("-m", "uvicorn", "ai.main:app", "--host", "127.0.0.1", "--port", "8001") },
        @{ Name = "Web"; File = "node"; Dir = $web; Log = "web";
           Args = @("node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", "4173", "--strictPort") }
    )
    Write-Host "`n== starting the API, the AI service and vite preview (logs in $LogDir)"
    foreach ($s in $services) {
        $out = Join-Path $LogDir "$($s.Log).log"
        $err = Join-Path $LogDir "$($s.Log).err.log"
        $p = Start-Process -FilePath $s.File -ArgumentList $s.Args -WorkingDirectory $s.Dir -NoNewWindow -PassThru `
            -RedirectStandardOutput $out -RedirectStandardError $err
        $null = $p.Handle                             # cached, or ExitCode reads empty once it exits
        $procs +=@{ Name = $s.Name; Proc = $p; Log = $err }
    }

    $health = Wait-Http "API" "$ApiUrl/health" $procs[0].Proc 180 $procs[0].Log
    $detail = if ($health.mode -eq "data") { "$('{0:N0}' -f $health.lot_count) lots, $($health.ward_count) wards" } else { $health.mode }
    Write-Host "   API ready: $detail, demo cache $($health.demo_cache)"
    Wait-Http "AI service" "$AiUrl/health" $procs[1].Proc 60 $procs[1].Log | Out-Null
    Write-Host "   AI service ready"
    Wait-Http "Web" "$WebUrl/" $procs[2].Proc 60 $procs[2].Log | Out-Null
    Write-Host "   web ready"

    Write-Host "`n== Suplex is running. Ctrl+C stops all three." -ForegroundColor Green
    Write-Host "  App        $WebUrl"
    Write-Host "  API        $ApiUrl/health"
    Write-Host "  AI         $AiUrl/health"
    Write-Host "  Briefing   $AiUrl/b/04"
    Write-Host "  Logs       $LogDir"

    while ($true) {
        foreach ($p in $procs) {
            if ($p.Proc.HasExited) { Stop-Demo "$($p.Name) stopped (code $($p.Proc.ExitCode)); see $($p.Log). Stopping the rest." }
        }
        Start-Sleep -Seconds 1
    }
}
finally {
    foreach ($p in $procs) {
        if (-not $p.Proc.HasExited) { Stop-Process -Id $p.Proc.Id -Force -ErrorAction SilentlyContinue }
    }
    Pop-Location
    foreach ($name in $saved.Keys) { [Environment]::SetEnvironmentVariable($name, $saved[$name]) }
}
