@echo off
setlocal
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python tidak ditemukan. Instal Python 3.11-3.13 dan aktifkan opsi Add Python to PATH.
  pause
  exit /b 1
)
if not exist ".venv\Scripts\python.exe" (
  echo Menyiapkan lingkungan Python...
  python -m venv .venv
  if errorlevel 1 goto failed
)
if not exist ".venv\kantin-dependencies.ok" (
  echo Memasang dependensi. Koneksi internet diperlukan pada langkah ini...
  ".venv\Scripts\python.exe" -m pip install -r requirements.txt
  if errorlevel 1 goto failed
  echo ok> ".venv\kantin-dependencies.ok"
)
if not exist "frontend\dist\index.html" (
  where npm >nul 2>nul
  if errorlevel 1 (
    echo Tampilan React belum dibangun dan Node.js tidak ditemukan.
    echo Instal Node.js LTS dari nodejs.org lalu jalankan ulang file ini.
    pause
    exit /b 1
  )
  echo Membangun tampilan React. Koneksi internet diperlukan pada langkah ini...
  pushd frontend
  call npm install
  if errorlevel 1 (popd & goto failed)
  call npm run build
  if errorlevel 1 (popd & goto failed)
  popd
)
echo.
echo Buka http://127.0.0.1:5000 di browser. Tekan Ctrl+C untuk berhenti.
echo Petugas: http://127.0.0.1:5000/petugas
".venv\Scripts\python.exe" app.py
pause
exit /b
:failed
echo Pengaturan gagal. Periksa koneksi internet dan versi Python.
pause
exit /b 1
