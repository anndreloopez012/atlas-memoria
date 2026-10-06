# Abre el Atlas de memoria: servidor local con sincronización en vivo
# (http://localhost:5190 o el puerto de atlas.config.json). Si todavía no está
# instalado, lo instala primero. Las opciones se pasan a Vite (p. ej. --open).
#
#   powershell -ExecutionPolicy Bypass -File iniciar.ps1
$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')

$tieneNode = $null -ne (Get-Command node -ErrorAction SilentlyContinue)
if (-not $tieneNode -or -not (Test-Path 'atlas.config.json') -or -not (Test-Path 'node_modules')) {
  & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'instalar.ps1')
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}
& npm run dev -- @args
exit $LASTEXITCODE
