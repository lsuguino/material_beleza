# Design Beleza - inicia o servidor
Set-Location $PSScriptRoot

$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npm) {
  Write-Host "Node.js nao encontrado no PATH." -ForegroundColor Yellow
  Write-Host ""
  Write-Host "Instale o Node.js em https://nodejs.org e reinicie o terminal."
  Write-Host "Depois execute: npm install"
  Write-Host "E em seguida: npm run dev"
  exit 1
}

if (-not (Test-Path "node_modules")) {
  Write-Host "Instalando dependencias..." -ForegroundColor Cyan
  npm install
  if ($LASTEXITCODE -ne 0) { exit 1 }
}

Write-Host "Iniciando servidor em http://localhost:3000" -ForegroundColor Green
Write-Host ""
npm run dev
