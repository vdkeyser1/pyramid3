<#
.SYNOPSIS
  Audit completo di tutti gli asset 3D (.glb), texture (.png, .ktx2, .jpg) e audio (.ogg, .wav)
  presenti in public/assets/ con calcolo dimensioni e conteggio formati.
#>

param (
    [string]$AssetsDir = "public"
)

Write-Host "🏛️ ========================================================" -ForegroundColor Cyan
Write-Host "   AUDIT ASSET — LA PIRAMIDE PERDUTA" -ForegroundColor Cyan
Write-Host "========================================================`n" -ForegroundColor Cyan

if (-not (Test-Path $AssetsDir)) {
    Write-Error "Cartella $AssetsDir non trovata."
    exit 1
}

$files = Get-ChildItem -Path $AssetsDir -Recurse -File
$glbs = $files | Where-Object { $_.Extension -match "\.glb|\.gltf" }
$textures = $files | Where-Object { $_.Extension -match "\.png|\.ktx2|\.jpg|\.webp" }
$audio = $files | Where-Object { $_.Extension -match "\.ogg|\.wav|\.mp3" }

$totalBytes = ($files | Measure-Object -Property Length -Sum).Sum
$glbBytes = ($glbs | Measure-Object -Property Length -Sum).Sum
$texBytes = ($textures | Measure-Object -Property Length -Sum).Sum
$audBytes = ($audio | Measure-Object -Property Length -Sum).Sum

function Format-Size($bytes) {
    if ($null -eq $bytes) { return "0 KB" }
    if ($bytes -gt 1MB) { return "$([math]::Round($bytes / 1MB, 2)) MB" }
    return "$([math]::Round($bytes / 1KB, 1)) KB"
}

Write-Host "📊 RIEPILOGO COMPLESSIVO:" -ForegroundColor Yellow
Write-Host "  - File Totali:       $($files.Count) ($(Format-Size $totalBytes))"
Write-Host "  - Modelli 3D (GLB):  $($glbs.Count) ($(Format-Size $glbBytes))"
Write-Host "  - Texture:           $($textures.Count) ($(Format-Size $texBytes))"
Write-Host "  - Tracce Audio:      $($audio.Count) ($(Format-Size $audBytes))`n"

Write-Host "📦 MODELLI 3D RILEVATI:" -ForegroundColor Green
$glbs | ForEach-Object {
    $rel = Resolve-Path -Path $_.FullName -Relative
    Write-Host ("  {0,-50} : {1,10}" -f $rel, (Format-Size $_.Length))
}

Write-Host "`n✨ Audit completato con successo." -ForegroundColor Cyan
