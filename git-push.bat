@echo off
title Subir projeto no GitHub
cd /d "%~dp0"

where git >nul 2>&1
if %errorlevel% neq 0 (
  echo Git nao encontrado. Instale em https://git-scm.com/download/win
  pause
  exit /b 1
)

if not exist .git (
  echo Inicializando Git...
  git init
  git branch -M main
)

echo Adicionando arquivos...
git add .

git diff --cached --quiet 2>nul
if %errorlevel% equ 0 (
  echo Nenhuma alteracao para commit.
) else (
  echo Criando commit...
  git commit -m "Design Beleza: VTT em material didático - versão completa"
)

echo Conectando ao repositorio...
git remote remove origin 2>nul
git remote add origin https://github.com/lsuguino/design_beleza.git

echo Enviando para o GitHub (main)...
git push -u origin main
if %errorlevel% neq 0 (
  echo.
  echo Se o GitHub recusar por historico diferente, tente:
  echo   git pull origin main --allow-unrelated-histories
  echo   git push -u origin main
  echo Ou para sobrescrever o remoto: git push -u origin main --force
)

echo.
echo Repositorio: https://github.com/lsuguino/design_beleza
pause
