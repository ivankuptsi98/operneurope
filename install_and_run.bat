@echo off
REM OpenEurope - Installer & Launcher per Windows
REM Installa dipendenze e avvia l'applicazione

setlocal enabledelayedexpansion

echo.
echo ============================================================
echo   OpenEurope - Installer ^& Launcher
echo ============================================================
echo.

REM Verifica Python
echo [*] Verifica Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo [X] Python non trovato! Installare Python 3.8+
    pause
    exit /b 1
)
for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
echo [+] Python %PYTHON_VERSION% OK

REM Installa dipendenze
echo.
echo [*] Installazione dipendenze...
echo [*] Installazione pandas...
python -m pip install --quiet pandas
if errorlevel 1 (
    echo [X] Errore nell'installazione di pandas
    pause
    exit /b 1
)
echo [+] pandas installato

echo [*] Installazione openpyxl...
python -m pip install --quiet openpyxl
if errorlevel 1 (
    echo [X] Errore nell'installazione di openpyxl
    pause
    exit /b 1
)
echo [+] openpyxl installato

REM Verifica dipendenze
echo.
echo [*] Verifica dipendenze...
python -c "import pandas" >nul 2>&1
if errorlevel 1 (
    echo [X] pandas non trovato
    pause
    exit /b 1
)
echo [+] pandas OK

python -c "import openpyxl" >nul 2>&1
if errorlevel 1 (
    echo [X] openpyxl non trovato
    pause
    exit /b 1
)
echo [+] openpyxl OK

REM Verifica struttura progetto
echo.
echo [*] Verifica struttura progetto...
if not exist "openeurope.py" (
    echo [X] openeurope.py non trovato
    pause
    exit /b 1
)
echo [+] openeurope.py OK

if not exist "run_demo.py" (
    echo [X] run_demo.py non trovato
    pause
    exit /b 1
)
echo [+] run_demo.py OK

if not exist "demo\OpenEurope_Demo_Semplice_v3\app.js" (
    echo [X] app.js non trovato
    pause
    exit /b 1
)
echo [+] app.js OK

REM Avvia il server
echo.
echo [*] Avvio server OpenEurope...
echo [+] Server in avvio... apri il browser tra qualche secondo
echo.
timeout /t 2 /nobreak

REM Apri il browser e avvia il server
start http://localhost:8000/START_HERE.html
python run_demo.py

echo.
echo [+] OpenEurope fermato
pause
