@echo off
title La Piramide Perduta
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"
echo █ La Piramide Perduta — Egyptian Noir Roguelike FPS
echo.
echo Avvio server Vite su http://localhost:5175/...
echo.

start /B "" "npx.cmd" vite --host --port 5175

echo Attendo l'avvio del server...
:wait
timeout /t 2 /nobreak >nul
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:5175/' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
if errorlevel 1 goto wait

echo Server pronto! Apro il browser...
start "" "http://localhost:5175/"
echo.
echo Premi Ctrl+C per fermare il server.
echo.
pause >nul
