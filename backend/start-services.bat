@echo off
title Habition - Starting Services
if exist "%~dp0.env" (
    for /f "usebackq tokens=1,2 delims==" %%A in ("%~dp0.env") do set "%%A=%%B"
)

echo.
echo ======================================
echo  Habition Microservices Launcher
echo ======================================
echo.

cd /d %~dp0

wt ^
new-tab --title "Eureka :8761" -d "%~dp0EurekaServer\EurekaServer" cmd /k "mvnw.cmd spring-boot:run" ; ^
new-tab --title "Gateway :8080" -d "%~dp0ApiGateway\ApiGateway" cmd /k "timeout /t 10 && mvnw.cmd spring-boot:run" ; ^
new-tab --title "Auth :8081" -d "%~dp0AuthService" cmd /k "timeout /t 15 && mvnw.cmd spring-boot:run" ; ^
new-tab --title "Group :8082" -d "%~dp0GroupService" cmd /k "set MEILISEARCH_MASTER_KEY=%MEILISEARCH_MASTER_KEY%&& timeout /t 20 && mvnw.cmd spring-boot:run" ; ^
new-tab --title "Habit :8083" -d "%~dp0HabitService" cmd /k "timeout /t 25 && mvnw.cmd spring-boot:run" ; ^
new-tab --title "Coin :8084" -d "%~dp0CoinService" cmd /k "timeout /t 30 && mvnw.cmd spring-boot:run"

echo.
echo ======================================
echo  All services launched in Windows Terminal
echo ======================================
pause