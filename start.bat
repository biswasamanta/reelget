@echo off
echo Starting VidSave...

:: Start backend
start "VidSave Backend" cmd /k "cd backend && pip install -r requirements.txt && uvicorn main:app --reload --port 8000"

:: Wait a moment then start frontend
timeout /t 3 /nobreak >nul
start "VidSave Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:3001
echo.
