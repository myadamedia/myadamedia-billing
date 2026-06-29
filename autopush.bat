@echo off
:: ============================================================
::  SCRIPT AUTO PUSH GITHUB - Windows
:: ============================================================
::  Script ini akan mengecek perubahan setiap 5 menit (300 detik)
::  dan otomatis melakukan push ke GitHub jika ada perubahan.
:: ============================================================

:: Tentukan durasi jeda (dalam detik)
set INTERVAL=300

:loop
cls
echo ============================================================
echo  [AUTO PUSH RUNNING] Jam: %time%
echo ============================================================
echo.

:: Pastikan git terinstal
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Git tidak terdeteksi di sistem Anda!
    echo Silakan install Git terlebih dahulu dan pastikan masuk ke Environment Path.
    pause
    exit /b
)

:: Cek apakah folder ini sudah diinisialisasi Git
if not exist .git (
    echo [ERROR] Folder ini belum diinisialisasi sebagai repositori Git!
    echo Silakan ikuti panduan inisialisasi Git terlebih dahulu.
    pause
    exit /b
)

echo Memeriksa perubahan file...
git add .
git diff-index --quiet HEAD --
if %errorlevel% neq 0 (
    echo [INFO] Menemukan perubahan. Mengunggah ke GitHub...
    git commit -m "Auto-update: %date% %time%"
    git push origin main
    echo [OK] Berhasil di-push!
) else (
    echo [INFO] Tidak ada perubahan terdeteksi.
)

echo.
echo Menunggu %INTERVAL% detik sebelum pengecekan berikutnya...
timeout /t %INTERVAL% /nobreak
goto loop
