@echo off
rem Desinstalador de doble clic para Windows. Quita "Atlas de memoria" del Escritorio y
rem del menu Inicio y borra la app de %LOCALAPPDATA%\Atlas de memoria. Antes muestra
rem que va a quitar y pide confirmacion. Tus vaults y tus notas no se tocan.
setlocal
chcp 65001 >nul
set "INSTALADA=%LOCALAPPDATA%\Atlas de memoria"
rem Si se abre desde la carpeta instalada, corre desde una copia temporal (la carpeta se borra).
if /I "%~dp0"=="%INSTALADA%\" if not "%~1"=="--copia" (copy /y "%~f0" "%TEMP%\Desinstalar Atlas de memoria.cmd" >nul & call "%TEMP%\Desinstalar Atlas de memoria.cmd" --copia & exit /b)
set "APP=%~dp0"
if exist "%INSTALADA%\scripts\desinstalar.mjs" set "APP=%INSTALADA%\"
rem Se sale de la carpeta de la app para poder borrarla.
cd /d "%USERPROFILE%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$env:Path = [Environment]::GetEnvironmentVariable(Path,Machine) + ; + [Environment]::GetEnvironmentVariable(Path,User); if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Write-Host No encontre Node.js. Para desinstalar a mano: borra los accesos Atlas de memoria del Escritorio y del menu Inicio, y la carpeta %INSTALADA%.; exit 1 }; & node %APP%scripts\desinstalar.mjs"
echo.
pause
