<#
.SYNOPSIS
The Hour-24 headline lock (MASTERSPEC 0.3, 8.1 A11), in order, stopping at the first failing step.

.DESCRIPTION
Run it from the repo root on the machine with the citywide data. The refresh takes a few minutes and the
batch about 21:

    powershell -ExecutionPolicy Bypass -File scripts\hour24.ps1            # the whole lock
    powershell -ExecutionPolicy Bypass -File scripts\hour24.ps1 -DryRun    # the plan and the refresh's preflight
    powershell -ExecutionPolicy Bypass -File scripts\hour24.ps1 -From 2    # resume at the batch after a failure
    ... -From 2 -Gpkg data\out\suplex_citywide.gpkg                        # lock on an older citywide file

  1. python pipeline/refresh.py --tiger     Yuvi's refresh: City data, permits, the citywide build into
                                            data\out\suplex.gpkg, Tiger Data and its trend cache, the checks
  2. python -m suplex_engine.batch --all    ward_summary.json, wards\*.geojson, batch_report.md
  3. python -m api.cache_demo               api\cache\ and data\out\demo-cache\
  4. the reminders for the steps done by hand

Steps 2 and 3 get SUPLEX_DATA_DIR=data\out and SUPLEX_GPKG=-Gpkg (default data\out\suplex.gpkg, the file step 1
rebuilds; a SUPLEX_GPKG already in the environment is overridden, so an old file is never locked by accident).
Keys in .env that are not set yet (TIGER_DSN) are loaded first, so the batch counts permits from Tiger Data;
no value is ever printed. -DryRun changes nothing. scripts/hour24.sh is the same for bash.
#>
[CmdletBinding()]
param(
    [ValidateRange(1, 3)][int]$From = 1,
    [string]$Gpkg = "",
    [string]$Python = "",
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $false    # every step's exit code is checked; stderr is just output

$Root = Split-Path -Parent $PSScriptRoot
$DataDir = Join-Path $Root "data\out"
$Rebuilt = Join-Path $DataDir "suplex.gpkg"           # what step 1 writes (pipeline/build_lots.py --out)
$GpkgPath = if ($Gpkg) { [IO.Path]::GetFullPath([IO.Path]::Combine($Root, $Gpkg)) } else { $Rebuilt }
if (-not $Python) {
    $venv = Join-Path $Root ".venv\Scripts\python.exe"
    $Python = if (Test-Path $venv) { $venv } else { "python" }
}
$Steps = @(
    @{ N = 1; Args = @("pipeline/refresh.py", "--tiger"); Label = "Yuvi's refresh (City data, permits, citywide build, Tiger Data, trend cache, checks)" },
    @{ N = 2; Args = @("-m", "suplex_engine.batch", "--all"); Label = "the citywide batch (about 21 minutes)" },
    @{ N = 3; Args = @("-m", "api.cache_demo"); Label = "the demo cache for Ward 04 and the three addresses" }
)

$saved = @{}                                          # the environment as it was, restored at the end
function Set-RunEnv([string]$Name, [string]$Value) {
    if (-not $saved.ContainsKey($Name)) { $saved[$Name] = [Environment]::GetEnvironmentVariable($Name) }
    [Environment]::SetEnvironmentVariable($Name, $Value)
}

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
    $inherited = [Environment]::GetEnvironmentVariable("SUPLEX_GPKG")
    Set-RunEnv "SUPLEX_DATA_DIR" $DataDir
    Set-RunEnv "SUPLEX_GPKG" $GpkgPath

    Write-Host "Hour-24 headline lock, $(Get-Date -Format 'yyyy-MM-dd HH:mm')$(if ($DryRun) { ', dry run: nothing is changed' })"
    Write-Host "  repo        $Root"
    Write-Host "  python      $Python"
    Write-Host "  data        $DataDir"
    Write-Host "  GeoPackage  $GpkgPath (steps 2 and 3)"
    Write-Host "  TIGER_DSN   $(if ($env:TIGER_DSN) { 'set' } else { 'NOT set: the batch will count permits from permit_counts.json' })"
    if ($inherited -and $inherited -ne $GpkgPath) {
        Write-Host "  note: SUPLEX_GPKG was $inherited in this shell; this run uses the file above (-Gpkg to choose)"
    }
    if ($From -le 1 -and $GpkgPath -ne $Rebuilt) {
        Write-Host "  note: step 1 rebuilds $Rebuilt, but steps 2 and 3 read $GpkgPath" -ForegroundColor Yellow
    }

    if ($DryRun) {
        Write-Host "`nThe real run would do, in order:"
        foreach ($s in $Steps) {
            $mark = if ($s.N -lt $From) { "skip" } else { "  $($s.N)." }
            Write-Host "  $mark python $($s.Args -join ' ')    -- $($s.Label)"
        }
        if ($From -ge 2 -and -not (Test-Path $GpkgPath)) {
            Write-Host "  [FIX] GeoPackage not found: $GpkgPath" -ForegroundColor Red
            exit 1
        }
        if ($From -le 1) {
            Write-Host "`n`$ python pipeline/refresh.py --dry-run --tiger"
            & $Python pipeline/refresh.py --dry-run --tiger
            exit $LASTEXITCODE
        }
        exit 0
    }

    $started = Get-Date
    foreach ($s in $Steps) {
        $command = "python $($s.Args -join ' ')"
        if ($s.N -lt $From) { Write-Host "`n== step $($s.N) skipped (-From $From): $command"; continue }
        if ($s.N -ge 2 -and -not (Test-Path $GpkgPath)) {
            Write-Host "!! step $($s.N): GeoPackage not found: $GpkgPath (-Gpkg to choose)" -ForegroundColor Red
            exit 1
        }
        if ($s.N -eq [math]::Max($From, 2)) {
            $f = Get-Item $GpkgPath
            Write-Host "`n   GeoPackage: $($f.FullName), $([math]::Round($f.Length / 1MB)) MB, modified $($f.LastWriteTime.ToString('yyyy-MM-dd HH:mm'))"
        }
        Write-Host "`n== step $($s.N) of 3, $(Get-Date -Format 'HH:mm:ss'): $($s.Label)"
        Write-Host "`$ $command"
        $t0 = Get-Date
        & $Python @($s.Args)
        $code = $LASTEXITCODE
        $secs = [int]((Get-Date) - $t0).TotalSeconds
        if ($code -ne 0) {
            Write-Host "!! step $($s.N) failed (exit $code) after $secs s: $command" -ForegroundColor Red
            Write-Host "!! nothing after it ran. Fix it, then resume with: scripts\hour24.ps1 -From $($s.N)" -ForegroundColor Red
            exit $code
        }
        Write-Host "== step $($s.N) done in $secs s"
    }

    # The addresses are api/cache_demo.py's ADDRESSES; keep them in step.
    $minutes = [int]((Get-Date) - $started).TotalMinutes
    Write-Host "`n== headline locked in $minutes min. Now, by hand:" -ForegroundColor Green
    Write-Host "  1. Andrew: tag main headline-locked (git tag headline-locked; git push origin headline-locked)"
    Write-Host "     and put the data\out snapshot on the drive."
    Write-Host "  2. Simone: the AI pre-generation, with the API running on this data (SUPLEX_API_URL, default"
    Write-Host "     http://localhost:8000), Ward 04 in English and French first (MASTERSPEC 7.9):"
    Write-Host "       python -m ai.pregenerate --ward 04 --langs all --address-id 7986858 --address-id 7955411 --address-id 9085619"
    Write-Host "  3. Jayden: copy data\out\demo-cache\ into web\public\demo-cache\ (again at Hour 30)."
    exit 0
}
finally {
    Pop-Location
    foreach ($name in $saved.Keys) { [Environment]::SetEnvironmentVariable($name, $saved[$name]) }
}
