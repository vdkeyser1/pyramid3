<#
.SYNOPSIS
  Scarica HDRI desert da Poly Haven (CC0) via API files.
  `desert_road_puresky` non esiste nel catalogo: fallback su goegap_road (Desert & Arid).
.EXAMPLE
  .\scripts\Download-PolyHavenHdri.ps1 -HdriName desert_road_puresky -Resolution 1k
#>
param(
    [string]$HdriName = "desert_road_puresky",
    [ValidateSet('1k','2k','4k')]
    [string]$Resolution = "1k",
    [string]$OutDir = ".\public\hdri"
)

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

function Get-PolyHavenHdrUrl {
    param([string]$AssetId, [string]$Res)
    try {
        $files = Invoke-RestMethod -Uri "https://api.polyhaven.com/files/$AssetId" -UseBasicParsing
        return [string]$files.hdri.$Res.hdr.url
    } catch {
        return $null
    }
}

$requestedId = $HdriName
$fallbackId = "goegap_road"
$assetId = $requestedId
$url = Get-PolyHavenHdrUrl -AssetId $assetId -Res $Resolution
if (-not $url) {
    Write-Host "Asset '$requestedId' assente su Poly Haven. Fallback: $fallbackId" -ForegroundColor Yellow
    $assetId = $fallbackId
    $url = Get-PolyHavenHdrUrl -AssetId $assetId -Res $Resolution
}

$hdrPath = Join-Path $OutDir "${HdriName}_${Resolution}.hdr"
$aliasPath = Join-Path $OutDir "${HdriName}.hdr"

if (-not $url) {
    Write-Host "Nessun URL HDR disponibile per $requestedId / $fallbackId ($Resolution)." -ForegroundColor Red
    exit 1
}

Write-Host "Downloading $assetId ($Resolution) -> $hdrPath" -ForegroundColor Cyan
try {
    Invoke-WebRequest -Uri $url -OutFile $hdrPath -UseBasicParsing
    Copy-Item -Force $hdrPath $aliasPath
    Write-Host "Download OK: $hdrPath ($((Get-Item $hdrPath).Length) bytes)" -ForegroundColor Green
} catch {
    Write-Host "Download fallito: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "URL: $url" -ForegroundColor Yellow
    exit 1
}

if (Get-Command magick -ErrorAction SilentlyContinue) {
    Write-Host "ImageMagick presente: HDR gia' in RGBE, nessuna conversione necessaria." -ForegroundColor Green
}
