$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectRoot ".env"
$requiredVariables = @("N8N_API_URL", "N8N_API_KEY")

if (-not (Test-Path -LiteralPath $envFile -PathType Leaf)) {
    [Console]::Error.WriteLine("n8n MCP: .env file not found at $envFile")
    exit 1
}

foreach ($line in Get-Content -LiteralPath $envFile) {
    if ($line -match '^\s*(N8N_API_URL|N8N_API_KEY)\s*=\s*(.*)\s*$') {
        $name = $matches[1]
        $value = $matches[2].Trim()

        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
            ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }

        [Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
}

foreach ($name in $requiredVariables) {
    $value = [Environment]::GetEnvironmentVariable($name, "Process")
    if ([string]::IsNullOrWhiteSpace($value)) {
        [Console]::Error.WriteLine("n8n MCP: $name is missing or empty in .env")
        exit 1
    }
}

$env:MCP_MODE = "stdio"
$env:LOG_LEVEL = "error"
$env:DISABLE_CONSOLE_OUTPUT = "true"
# Local n8n runs behind n8n.localhost; moderate keeps private networks and
# cloud metadata blocked while allowing the loopback address.
$env:WEBHOOK_SECURITY_MODE = "moderate"

$npxCache = Join-Path $projectRoot ".cache\npx-v2"
$cachedEntry = Get-ChildItem -Path (Join-Path $npxCache "_npx\*\node_modules\n8n-mcp\dist\mcp\stdio-wrapper.js") -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

if ($cachedEntry) {
    & node.exe $cachedEntry.FullName
} else {
    & npx.cmd --cache $npxCache -y n8n-mcp@2.69.2
}
exit $LASTEXITCODE
