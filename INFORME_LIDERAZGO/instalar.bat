@echo off
setlocal enabledelayedexpansion
title CCHH - Instalador
cd /d "%~dp0"

echo.
echo  =====================================================
echo       CCHH - Instalador Informe de Liderazgo
echo  =====================================================
echo.

REM ---- 1. Verificar Python --------------------------------
echo  [1/3] Verificando Python...

python --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%v in ('python --version 2^>^&1') do set PYVER=%%v
    echo  [OK] !PYVER! encontrado.
    goto :instalar_libs
)

REM Python no encontrado - intentar con winget
echo  [!] Python no encontrado. Instalando con winget...
echo.
winget install --id Python.Python.3.12 --source winget --accept-package-agreements --accept-source-agreements --silent
if %errorlevel% equ 0 (
    echo  [OK] Python instalado correctamente.
    echo.
    echo  IMPORTANTE: cierre esta ventana, abra una nueva terminal
    echo  y vuelva a ejecutar instalar.bat para continuar.
    echo.
    pause
    exit /b 0
)

REM winget fallo - descarga manual
echo.
echo  =====================================================
echo   No se pudo instalar Python automaticamente.
echo.
echo   Por favor:
echo   1. Abra https://www.python.org/downloads/
echo   2. Descargue e instale Python 3.x (64-bit)
echo   3. MARQUE "Add Python to PATH" al instalar
echo   4. Vuelva a ejecutar este instalador
echo  =====================================================
echo.
start https://www.python.org/downloads/
pause
exit /b 1

REM ---- 2. Instalar librerias ------------------------------
:instalar_libs
echo.
echo  [2/3] Instalando librerias Python...
echo.

python -m pip install --upgrade pip --quiet
if %errorlevel% neq 0 (
    echo  [AVISO] No se pudo actualizar pip, continuando igual...
)

python -m pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Hubo un problema instalando las librerias.
    echo  Intente ejecutar manualmente:
    echo    python -m pip install -r requirements.txt
    echo.
    pause
    exit /b 1
)

echo.
echo  [OK] Librerias instaladas correctamente.

REM ---- 3. Crear acceso directo en el Escritorio ----------
echo.
echo  [3/3] Creando acceso directo en el Escritorio...

set "SCRIPT_DIR=%~dp0"
set "SHORTCUT=%USERPROFILE%\Desktop\CCHH Informes.lnk"

powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT%'); $s.TargetPath = '%SCRIPT_DIR%ejecutar.bat'; $s.WorkingDirectory = '%SCRIPT_DIR%'; $s.IconLocation = 'shell32.dll,23'; $s.Description = 'CCHH Generador de Informes de Liderazgo'; $s.Save()" >nul 2>&1

if exist "%SHORTCUT%" (
    echo  [OK] Acceso directo creado en el Escritorio.
) else (
    echo  [AVISO] No se pudo crear el acceso directo (no es critico).
)

REM ---- Listo ----------------------------------------------
echo.
echo  =====================================================
echo        Instalacion completada con exito!
echo.
echo   Para iniciar la aplicacion:
echo     - Doble clic en "CCHH Informes" del Escritorio
echo     - O ejecute ejecutar.bat en esta carpeta
echo  =====================================================
echo.
set /p ABRIR="Desea iniciar la aplicacion ahora? (S/N): "
if /i "!ABRIR!"=="S" (
    start "" "%~dp0ejecutar.bat"
)
pause
exit /b 0
