@echo off
title CCHH - Generador de Informes de Liderazgo
cd /d "%~dp0"

echo.
echo  CCHH - Generador de Informes de Liderazgo
echo  Directorio: %~dp0
echo  Iniciando servidor... (no cierre esta ventana)
echo.

python app.py

echo.
echo  El servidor se detuvo. Presione cualquier tecla para cerrar.
pause >nul
