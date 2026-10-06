# Instala el Atlas de memoria en Windows.
#
# Deja Node.js listo si falta (con winget), instala las dependencias y ejecuta el
# instalador del atlas: detecta vaults, skills y agentes, verifica y genera los
# datos. Las opciones se pasan tal cual a scripts/instalar.mjs:
#
#   powershell -ExecutionPolicy Bypass -File instalar.ps1
#   powershell -ExecutionPolicy Bypass -File instalar.ps1 --json
#   powershell -ExecutionPolicy Bypass -File instalar.ps1 --vault "C:\Users\yo\Notas"
$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot
$NodeMinimo = 20

function Get-VersionNode {
  try { return [int](& node -p "process.versions.node.split('.')[0]" 2>$null) } catch { return 0 }
}

# winget deja Node en el PATH del sistema, pero esta terminal no lo ve hasta recargarlo.
function Update-RutaDelSistema {
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}

if ((Get-VersionNode) -lt $NodeMinimo) {
  Write-Host "-> Node.js $NodeMinimo o superior no está disponible: lo instalo con winget."
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    throw "No encuentro winget. Instala Node.js $NodeMinimo o superior desde https://nodejs.org y vuelve a ejecutar este script."
  }
  winget install --id OpenJS.NodeJS.LTS -e --silent --accept-source-agreements --accept-package-agreements | Out-Host
  Update-RutaDelSistema
}
if ((Get-VersionNode) -lt $NodeMinimo) {
  throw "Node.js $NodeMinimo o superior sigue sin estar disponible. Cierra y abre la terminal, o instálalo desde https://nodejs.org."
}

Write-Host "-> Node.js $(node -v) · npm $(npm -v)"
& npm install --no-fund --no-audit --loglevel=error | Out-Host
if ($LASTEXITCODE -ne 0) { throw 'npm install falló: revisa la conexión a internet y vuelve a ejecutar.' }
& node scripts/instalar.mjs @args
exit $LASTEXITCODE
