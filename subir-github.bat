@echo off
chcp 65001 >nul
title Subir Design Beleza no GitHub
cd /d "%~dp0"

REM Tentar adicionar Git ao PATH se existir em locais comuns
if not defined ProgramFiles set "ProgramFiles=C:\Program Files"
if exist "%ProgramFiles%\Git\bin\git.exe" set "PATH=%ProgramFiles%\Git\bin;%PATH%"
if exist "C:\Program Files (x86)\Git\bin\git.exe" set "PATH=C:\Program Files (x86)\Git\bin;%PATH%"

echo ============================================
echo   Design Beleza - Subir no GitHub
echo   Repo: https://github.com/lsuguino/design_beleza
echo ============================================
echo.

where git >nul 2>&1
if %errorlevel% neq 0 (
  echo [ERRO] Git nao encontrado.
  echo Instale em: https://git-scm.com/download/win
  echo Marque a opcao "Add Git to PATH" na instalacao.
  echo Depois feche e abra o CMD e rode este script de novo.
  echo.
  pause
  exit /b 1
)

echo [1/6] Git encontrado.
git --version
echo.

if not exist .git (
  echo [2/6] Inicializando repositorio...
  git init
  git branch -M main
) else (
  echo [2/6] Repositorio ja existe.
)
echo.

echo [3/6] Adicionando arquivos...
git add .
git status
echo.

echo [4/6] Criando commit...
git commit -m "Design Beleza - versão completa" 2>nul
if %errorlevel% neq 0 (
  echo Nenhuma alteracao nova para commit. Continuando...
) else (
  echo Commit criado.
)
echo.

echo [5/6] Configurando remote origin...
git remote remove origin 2>nul
git remote add origin https://github.com/lsuguino/design_beleza.git
echo Origin: https://github.com/lsuguino/design_beleza.git
echo.

echo [6/6] Enviando para o GitHub...
echo.
echo ATENCAO: Quando pedir "Password", use seu TOKEN do GitHub,
echo nao a senha da conta. Crie em: https://github.com/settings/tokens
echo.
git push -u origin main

if %errorlevel% neq 0 (
  echo.
  echo ============================================
  echo   PUSH FALHOU - Tente o seguinte:
  echo ============================================
  echo.
  echo 1. Se pediu senha: use um TOKEN (nao a senha).
  echo    Criar token: https://github.com/settings/tokens
  echo    Marque a permissao "repo".
  echo.
  echo 2. Se disse "unrelated histories", rode no CMD:
  echo    git pull origin main --allow-unrelated-histories --no-edit
  echo    git push -u origin main
  echo.
  echo 3. Leia o arquivo SUBIR-NO-GITHUB.md para mais detalhes.
  echo.
)

echo.
pause
