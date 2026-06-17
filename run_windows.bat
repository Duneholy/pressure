@echo off
title The Pressure - Task Tracker

echo ========================================================
echo        THE PRESSURE - Application Initialization
echo ========================================================
echo.

:: Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed. Please download and install Python from:
    echo https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation!
    pause
    exit /b 1
)

:: Check if virtual environment exists
if not exist ".venv\Scripts\activate" (
    echo [INFO] Creating Python virtual environment...
    python -m venv .venv
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )
)

:: Activate virtual environment
call .venv\Scripts\activate

:: Install requirements
echo [INFO] Checking and installing dependencies ^(this may take a while on first run^)...
pip install -r requirements.txt >nul
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies. Check requirements.txt.
    pause
    exit /b 1
)

:: Run the application
echo.
echo [OK] The application is ready to launch!
echo Opening browser: http://127.0.0.1:8000
echo.
echo Press CTRL+C in this window to stop the server.
echo ========================================================
start /b cmd /c "timeout /t 3 /nobreak >nul & start http://127.0.0.1:8000"
uvicorn backend.main:app --port 8000
pause
