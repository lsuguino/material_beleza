# Script para subir o projeto no GitHub (thiagottd/design_beleza)
# Execute no PowerShell: .\subir-github.ps1

Write-Host "=== Subindo projeto para GitHub ===" -ForegroundColor Cyan

# 1. Alterar remote para o repositório correto
Write-Host "`n1. Configurando remote..." -ForegroundColor Yellow
git remote set-url origin https://github.com/thiagottd/design_beleza.git
git remote -v

# 2. Adicionar e commitar (se houver alterações)
Write-Host "`n2. Verificando alterações..." -ForegroundColor Yellow
git add .
$status = git status --porcelain
if ($status) {
    git commit -m "Projeto completo - Material Beleza"
    Write-Host "Commit realizado." -ForegroundColor Green
} else {
    Write-Host "Nada para commitar (já está tudo salvo)." -ForegroundColor Green
}

# 3. Push para o novo repositório
Write-Host "`n3. Enviando para GitHub..." -ForegroundColor Yellow
git push -u origin main --force

Write-Host "`n=== Concluído! ===" -ForegroundColor Green
