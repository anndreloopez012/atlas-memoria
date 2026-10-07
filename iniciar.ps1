# Abre el Atlas de memoria (Windows). Es lo que ejecuta el acceso de doble clic:
# si falta algo lo instala, busca cambios en vaults, skills y agentes, abre el
# navegador y deja el servidor en segundo plano (se apaga solo al dejar de usarlo).
#
#   powershell -ExecutionPolicy Bypass -File iniciar.ps1          abre la app
#   powershell -ExecutionPolicy Bypass -File iniciar.ps1 -Dev     modo desarrollo
param([switch]$Dev)
$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')

$tieneNode = $null -ne (Get-Command node -ErrorAction SilentlyContinue)
if (-not $tieneNode -or -not (Test-Path 'atlas.config.json') -or -not (Test-Path 'node_modules')) {
  & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'instalar.ps1') --sin-abrir
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}
if ($Dev) {
  & npm run dev
} else {
  & node (Join-Path $PSScriptRoot 'scripts/abrir.mjs')
}
exit $LASTEXITCODE
