@echo off
title Git: pull + push
cd /d "%~dp0"

where git >nul 2>&1
if %errorlevel% neq 0 (
  echo Git nao encontrado no PATH. Instale em https://git-scm.com/download/win
  pause
  exit /b 1
)

echo git pull origin main --allow-unrelated-histories
git pull origin main --allow-unrelated-histories
if %errorlevel% neq 0 (
  echo Erro no pull. Verifique se o remote origin esta configurado.
  pause
  exit /b 1
)

echo.
echo git push -u origin main
git push -u origin main

echo.
echo Concluido.
pause
