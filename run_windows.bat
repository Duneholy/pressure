@echo off
chcp 65001 >nul
title The Pressure - Task Tracker

echo ========================================================
echo        THE PRESSURE - Инициализация приложения
echo ========================================================
echo.

:: Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python не установлен. Пожалуйста, скачайте и установите Python (https://www.python.org/downloads/).
    echo Обязательно поставьте галочку "Add Python to PATH" при установке!
    pause
    exit /b 1
)

:: Check if virtual environment exists
if not exist ".venv\Scripts\activate" (
    echo [INFO] Создание виртуального окружения Python...
    python -m venv .venv
    if %errorlevel% neq 0 (
        echo [ERROR] Ошибка при создании виртуального окружения.
        pause
        exit /b 1
    )
)

:: Activate virtual environment
call .venv\Scripts\activate

:: Install requirements
echo [INFO] Проверка и установка зависимостей (может занять некоторое время при первом запуске)...
pip install -r requirements.txt >nul
if %errorlevel% neq 0 (
    echo [ERROR] Ошибка при установке зависимостей. Проверьте requirements.txt.
    pause
    exit /b 1
)

:: Run the application
echo.
echo [OK] Приложение готово к запуску!
echo Откройте в браузере: http://127.0.0.1:8000
echo.
echo Нажмите CTRL+C в этом окне для завершения работы сервера.
echo ========================================================
start /b cmd /c "timeout /t 3 /nobreak >nul & start http://127.0.0.1:8000"
uvicorn backend.main:app --port 8000
pause
