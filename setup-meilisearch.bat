@echo off
echo ==============================================
echo   Habition Meilisearch Setup Script (Windows)
echo ==============================================
echo.

if not exist "meilisearch" mkdir meilisearch
cd meilisearch

echo Downloading Meilisearch (v1.12.0) for Windows...
powershell -Command "Invoke-WebRequest -Uri 'https://github.com/meilisearch/meilisearch/releases/download/v1.12.0/meilisearch-windows-amd64.exe' -OutFile 'meilisearch.exe'"

if exist "meilisearch.exe" (
    echo.
    echo Download successful!
    echo To start Meilisearch, open a terminal in the 'meilisearch' folder and run:
    echo .\meilisearch.exe --master-key SBRmZ0tKs_Y1i3gQgH1aIZ6YI0LRojaqjSCI2yjUD-8
) else (
    echo.
    echo Download failed. Please download it manually from https://github.com/meilisearch/meilisearch/releases
)

cd ..
echo.
pause
