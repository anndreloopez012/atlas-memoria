@echo off
rem Instalador de doble clic para Windows. Copia el atlas a %LOCALAPPDATA%\Atlas de memoria
rem (asi sigue funcionando aunque borres la descarga), deja Node.js listo si falta,
rem detecta tus vaults, skills y agentes, crea "Atlas de memoria" en el Escritorio y
rem en el menu Inicio, y lo abre.
setlocal
chcp 65001 >nul
set "ORIGEN=%~dp0"
set "DESTINO=%LOCALAPPDATA%\Atlas de memoria"
echo.
echo   Atlas de memoria - instalacion
echo   ------------------------------
if /I not "%ORIGEN%"=="%DESTINO%\" (
  echo - Copiando la app a %DESTINO%...
  robocopy "%ORIGEN%." "%DESTINO%" /E /XD node_modules datos .atlas-cache /XF atlas.config.json /NFL /NDL /NJH /NJS /NP >nul
)
cd /d "%DESTINO%"
powershell -NoProfile -ExecutionPolicy Bypass -File "%DESTINO%\instalar.ps1" --abrir
echo.
echo Listo. Desde ahora abre "Atlas de memoria" desde el Escritorio o el menu Inicio.
echo Puedes cerrar esta ventana y borrar la descarga.
pause
