@echo off
title Design Beleza
cd /d "%~dp0"

where npm >nul 2>&1
if %errorlevel% neq 0 (
  echo Node.js nao encontrado no PATH.
  echo.
  echo Instale o Node.js em https://nodejs.org e reinicie o terminal.
  echo Depois execute: npm install
  echo E em seguida: npm run dev
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Instalando dependencias...
  call npm install
  if errorlevel 1 ( pause & exit /b 1 )
)

echo Iniciando servidor em http://localhost:3000
echo.
call npm run dev
pause
