@echo off
title Design Beleza
cd /d "%~dp0"

where npm >nul 2>&1
if %errorlevel% neq 0 (
  echo Node.js nao encontrado no PATH.
  echo Instale em https://nodejs.org e reinicie o terminal.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Instalando dependencias...
  call npm install
  if errorlevel 1 ( pause & exit /b 1 )
)

echo.
echo ========================================
echo   Design Beleza - Servidor local
echo ========================================
echo.
echo Aguarde aparecer "Ready" abaixo.
echo So entao abra no navegador: http://localhost:3000
echo.
echo Se a porta 3000 estiver em uso, o Next.js
echo usara 3001, 3002, etc. Veja a URL no terminal.
echo.
echo ========================================
echo.

call npm run dev
pause
