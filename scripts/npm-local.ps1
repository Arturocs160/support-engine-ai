param([Parameter(ValueFromRemainingArguments = $true)][string[]]$NpmArguments)

$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $PSScriptRoot
$runtime = Get-ChildItem -LiteralPath (Join-Path $projectDir '.tools') -Directory -Filter 'node-v24.*-win-x64' |
    Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'node.exe') } |
    Sort-Object { [version]($_.Name -replace '^node-v|-win-x64$', '') } -Descending |
    Select-Object -First 1
if (-not $runtime) { throw 'No se encontró Node.js portable. Instala Node.js 24 LTS y utiliza npm directamente.' }
$originalPath = $env:PATH
Push-Location -LiteralPath $projectDir
try {
    $env:PATH = $runtime.FullName + ';' + $env:PATH
    & (Join-Path $runtime.FullName 'npm.cmd') @NpmArguments
    $npmExitCode = $LASTEXITCODE
} finally {
    $env:PATH = $originalPath
    Pop-Location
}
exit $npmExitCode
