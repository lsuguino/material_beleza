@echo off
title Design Beleza - Servidor
REM Vai para a pasta onde esta este arquivo (pasta do projeto)
cd /d "%~dp0"

echo.
echo Pasta do projeto: %CD%
echo.

where npm >nul 2>&1
if %errorlevel% neq 0 (
  echo [ERRO] Node.js/npm nao encontrado no PATH.
  echo Instale o Node.js em https://nodejs.org
  pause
  exit /b 1
)

if not exist "package.json" (
  echo [ERRO] package.json nao encontrado. Este arquivo deve estar na pasta do projeto.
  echo Pasta atual: %CD%
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Instalando dependencias...
  call npm install
  if errorlevel 1 ( pause & exit /b 1 )
)

echo.
echo Iniciando servidor. Aguarde "Ready" e abra http://localhost:3000
echo.
call npm run dev
pause
