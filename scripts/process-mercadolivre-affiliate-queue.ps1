$ErrorActionPreference = "Stop"
$workerDir = "E:\Backup\freguesia\apps\worker"
$logFile = Join-Path $workerDir "data\mercadolivre-affiliate-queue.log"

Set-Location -LiteralPath $workerDir
& npm.cmd run process:mercadolivre-affiliate-queue *>> $logFile
exit $LASTEXITCODE
