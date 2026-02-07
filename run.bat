@echo off
echo === Building Vocalis Frontend ===

cd frontend
call npm run build
if errorlevel 1 (
    echo Failed to build frontend. Make sure npm dependencies are installed.
    exit /b 1
)
cd ..

echo === Frontend built successfully ===
echo === Starting Vocalis Server ===

REM Load environment variables from backend\.env
for /f "usebackq tokens=1,* delims==" %%a in (`type backend\.env ^| findstr /v "^#" ^| findstr /v "^$"`) do set "%%a=%%b"

REM Start server (backend serves frontend on the same port)
start cmd /k "call .\env\Scripts\activate && python -m backend.main"

echo === Vocalis server started ===
echo Access the app at: http://%SERVER_HOST%:%SERVER_PORT%
echo Server is listening on: %SERVER_HOST%:%SERVER_PORT%
