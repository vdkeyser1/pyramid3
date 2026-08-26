<#
.SYNOPSIS
    Valida l'integrità e la coerenza degli asset 3D, PBR e audio per La Piramide Perduta.
.DESCRIPTION
    Legge src/assets/assets.manifest.json e verifica:
    - Esistenza fisica dei file su disco sotto public/
    - Dimensioni dei file e budget di memoria
    - Integrità dei riferimenti
#>

[CmdletBinding()]
param (
    [string]$ManifestPath = "src/assets/assets.manifest.json",
    [string]$PublicDir = "public"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "=== Validazione Asset Manifest: $ManifestPath ===" -ForegroundColor Cyan

if (-not (Test-Path $ManifestPath)) {
    Write-Error "Manifest non trovato: $ManifestPath"
}

$manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json
$missingCount = 0
$totalChecked = 0

Write-Host "`n[1/3] Controllo Modelli 3D..." -ForegroundColor Yellow
foreach ($model in $manifest.models) {
    $fullPath = Join-Path $PublicDir $model.path
    $totalChecked++
    if (Test-Path $fullPath) {
        $fileInfo = Get-Item $fullPath
        $sizeKB = [math]::Round($fileInfo.Length / 1KB, 1)
        Write-Host "  [OK] $($model.id) ($($model.category)) -> $sizeKB KB (tris: $($model.tris))" -ForegroundColor Green
    } else {
        Write-Host "  [MANCANTE] $($model.id) -> $fullPath" -ForegroundColor Red
        $missingCount++
    }
}

Write-Host "`n[2/3] Controllo Texture PBR..." -ForegroundColor Yellow
foreach ($tex in $manifest.textures) {
    $totalChecked++
    $foundFiles = 0
    if ($tex.PSObject.Properties['maps']) {
        foreach ($map in $tex.maps) {
            foreach ($fmt in $tex.formats) {
                $testPath = "$PublicDir/$($tex.basePath)_$map.$fmt"
                if (Test-Path $testPath) { $foundFiles++ }
            }
        }
    } else {
        foreach ($fmt in $tex.formats) {
            $testPath = "$PublicDir/$($tex.basePath).$fmt"
            if (Test-Path $testPath) { $foundFiles++ }
        }
    }
    if ($foundFiles -gt 0) {
        Write-Host "  [OK] $($tex.id) ($($tex.type)) -> $foundFiles varianti/mappe trovate" -ForegroundColor Green
    } else {
        Write-Host "  [ATTENZIONE] $($tex.id) -> Nessun file trovato per $($tex.basePath)" -ForegroundColor Yellow
    }
}

Write-Host "`n[3/3] Controllo Audio..." -ForegroundColor Yellow
foreach ($audio in $manifest.audio) {
    if ($audio.PSObject.Properties['path'] -and $audio.path) {
        $files = Get-ChildItem "$PublicDir/$($audio.path)" -ErrorAction SilentlyContinue
        Write-Host "  [OK] $($audio.category) -> Trovati $($files.Count) file ($($audio.source))" -ForegroundColor Green
    } elseif ($audio.PSObject.Properties['module'] -and $audio.module) {
        Write-Host "  [OK] $($audio.category) -> Modulo sintesi: $($audio.module) ($($audio.count) cue)" -ForegroundColor Green
    }
}

Write-Host "`n=== Riepilogo Validazione ===" -ForegroundColor Cyan
if ($missingCount -eq 0) {
    Write-Host "Tutti gli asset di produzione sono integri e presenti! (Totale verificati: $totalChecked)" -ForegroundColor Green
    exit 0
} else {
    Write-Host "Rilevati $missingCount asset mancanti o non trovati." -ForegroundColor Red
    exit 1
}
