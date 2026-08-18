$ErrorActionPreference = "Stop"
$projectDir = "E:\Backup\freguesia"
$dockerDesktop = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
$logFile = Join-Path $projectDir "startup.log"

function Test-DockerReady {
  docker info *> $null
  return $LASTEXITCODE -eq 0
}

if (-not (Test-DockerReady)) {
  if (Test-Path -LiteralPath $dockerDesktop) {
    Start-Process -FilePath $dockerDesktop -WindowStyle Hidden
  }
  $deadline = (Get-Date).AddMinutes(3)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 5
    if (Test-DockerReady) { break }
  }
}

if (-not (Test-DockerReady)) {
  "$(Get-Date -Format o) Docker nao iniciou dentro do prazo." | Add-Content $logFile
  exit 1
}

Set-Location -LiteralPath $projectDir
$arguments = "/d /c docker compose up -d >> `"$logFile`" 2>&1"
$process = Start-Process -FilePath "cmd.exe" -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden
$composeExitCode = $process.ExitCode
if ($composeExitCode -eq 0) {
  "$(Get-Date -Format o) Servicos iniciados com sucesso." | Add-Content $logFile
}
exit $composeExitCode
