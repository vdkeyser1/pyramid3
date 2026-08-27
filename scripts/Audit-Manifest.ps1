<#
.SYNOPSIS
  Confronta src/assets/assets.manifest.json con i file su disco (public/).
#>
param([string]$ManifestPath = ".\src\assets\assets.manifest.json")

if (-not (Test-Path $ManifestPath)) {
    Write-Error "Manifest non trovato: $ManifestPath"
    exit 1
}

$manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json
$missing = @()
$present = @()

foreach ($asset in $manifest.models) {
    $path = Join-Path ".\public" $asset.path
    if (Test-Path $path) {
        $size = [math]::Round((Get-Item $path).Length / 1KB, 1)
        $present += [PSCustomObject]@{ Name=$asset.id; Path=$asset.path; Size="${size}KB"; Status="OK" }
    } else {
        $missing += [PSCustomObject]@{ Name=$asset.id; Path=$asset.path; Status="MISSING" }
    }
}

Write-Host "`n=== ASSET AUDIT ===" -ForegroundColor Cyan
Write-Host "Present: $($present.Count) / Models: $($manifest.models.Count)"
if ($missing.Count -gt 0) {
    Write-Host "`nMISSING ASSETS:" -ForegroundColor Red
    $missing | Format-Table -AutoSize
    exit 1
} else {
    Write-Host "All models present." -ForegroundColor Green
}
