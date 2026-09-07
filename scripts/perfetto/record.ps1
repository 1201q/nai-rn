param(
    [ValidateRange(5, 300)][int]$DurationSeconds = 120,
    [ValidatePattern('^[a-zA-Z0-9_.]+$')][string]$AppId = 'com.q1201.nairn.preview',
    [string]$Serial,
    [string]$OutputDirectory = (Join-Path $PSScriptRoot '../../artifacts/perfetto')
)

$ErrorActionPreference = 'Stop'
if (!$env:ANDROID_USER_HOME) {
    $env:ANDROID_USER_HOME = Join-Path $env:USERPROFILE '.android'
}
$adbArgs = @()
if ($Serial) { $adbArgs = @('-s', $Serial) }

function Invoke-PerfAdb {
    param([string[]]$Arguments)
    $result = & adb @adbArgs @Arguments
    if ($LASTEXITCODE -ne 0) { throw "ADB failed: $($Arguments -join ' ')" }
    return $result
}

$state = Invoke-PerfAdb -Arguments @('get-state')
if ($state -ne 'device') { throw 'Select one connected device with -Serial.' }
$null = New-Item -ItemType Directory -Force -Path $OutputDirectory
$OutputDirectory = (Resolve-Path -LiteralPath $OutputDirectory).Path
$runName = 'generation-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 8)
$configPath = Join-Path $OutputDirectory "$runName.pbtxt"
$tracePath = Join-Path $OutputDirectory "$runName.perfetto-trace"
$remoteConfig = "/data/misc/perfetto-configs/$runName.pbtxt"
$remoteTrace = "/data/misc/perfetto-traces/$runName.perfetto-trace"
$config = (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'generation.pbtxt') -Raw).
    Replace('__DURATION_MS__', [string]($DurationSeconds * 1000)).Replace('__APP_ID__', $AppId)
[IO.File]::WriteAllText($configPath, $config, [Text.UTF8Encoding]::new($false))
$null = Invoke-PerfAdb -Arguments @('push', $configPath, $remoteConfig)
$capturePid = Invoke-PerfAdb -Arguments @('shell', 'perfetto', '--background-wait', '--txt', '-c', $remoteConfig, '-o', $remoteTrace)
$capturePid = ($capturePid -join '').Trim()
if ($capturePid -notmatch '^\d+$') { throw "Unexpected Perfetto PID: $capturePid" }
Write-Host "RECORDING READY ($DurationSeconds seconds). Start app measurement, then run UI workload in another terminal."
Write-Host "Device output: $remoteTrace"
$deadline = [DateTime]::UtcNow.AddSeconds($DurationSeconds + 30)
do {
    Start-Sleep -Seconds 1
    # Perfetto runs under another UID; kill -0 may fail while it is still recording.
    $processIds = Invoke-PerfAdb -Arguments @('shell', 'ps', '-A', '-o', 'PID')
    $running = @($processIds | ForEach-Object { $_.Trim() }) -contains $capturePid
    if ($running -and [DateTime]::UtcNow -gt $deadline) {
        throw "Capture did not exit on time. Device trace retained at $remoteTrace"
    }
} while ($running)
$null = Invoke-PerfAdb -Arguments @('pull', $remoteTrace, $tracePath)
if ((Get-Item -LiteralPath $tracePath).Length -eq 0) { throw 'Empty trace file.' }
Write-Host "Saved: $tracePath"
Write-Host 'Stop app measurement and save its JSON beside the trace. Check FrameTimeline, nai.perf markers and trace data loss in Perfetto.'
