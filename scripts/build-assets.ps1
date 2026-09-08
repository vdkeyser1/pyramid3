<#
.SYNOPSIS
    Pipeline completa di verifica, audit e build degli asset per La Piramide Perduta.
#>

[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "   PIPELINE ASSET & BUILD — LA PIRAMIDE PERDUTA       " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

Write-Host "`n>>> [STEP 1/4] Audit Inventario Asset..." -ForegroundColor Yellow
& pwsh -File "scripts/audit-assets.ps1"

Write-Host "`n>>> [STEP 2/4] Validazione Manifest & File..." -ForegroundColor Yellow
& pwsh -File "scripts/validate-assets.ps1"

Write-Host "`n>>> [STEP 3/4] Esecuzione Test Unitari & DOM..." -ForegroundColor Yellow
& npx vitest run

Write-Host "`n>>> [STEP 4/4] Compilazione TypeScript & Vite Bundle..." -ForegroundColor Yellow
& npm run build

Write-Host "`n======================================================" -ForegroundColor Green
Write-Host "   PIPELINE COMPLETATA CON SUCCESSO!                  " -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
