@echo off
echo Adding Pointer CLI to PATH...

REM Get the scripts directory
for /f "tokens=*" %%i in ('python -c "import sys; from pathlib import Path; print(Path(sys.executable).parent / 'Scripts')"') do set SCRIPTS_DIR=%%i

echo Scripts directory: %SCRIPTS_DIR%

REM Add to PATH for current session
set PATH=%PATH%;%SCRIPTS_DIR%

REM Test if pointer command works
echo Testing pointer command...
pointer --version

if %errorlevel% equ 0 (
    echo ✅ Pointer command is working!
    echo.
    echo To make this permanent, run:
    echo setx PATH "%%PATH%%;%SCRIPTS_DIR%"
) else (
    echo ❌ Pointer command still not working
    echo Try running: python -m pointer_cli --version
)

pause
