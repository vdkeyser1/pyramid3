<#
.SYNOPSIS
  Download asset esterni CC0 per La Piramide Perduta.

.DESCRIPTION
  - AUTOMATICO: Kenney Mini Dungeon (ZIP diretto) → public/models/ruins/
  - MANUALE: Quaternius Ultimate Modular Ruins (Drive/lightbox, nessun URL stabile)
    → scarica dal browser, poi riesegui con -QuaterniusZip <path>

.EXAMPLE
  pwsh -File scripts/download-external-assets.ps1

.EXAMPLE
  pwsh -File scripts/download-external-assets.ps1 -QuaterniusZip "$env:USERPROFILE\Downloads\Ultimate_Modular_Ruins.zip"
#>
[CmdletBinding()]
param(
  [string]$QuaterniusZip = '',
  [string]$QuaterniusFolder = '',
  [switch]$SkipKenney,
  [switch]$Optimize
)

$ErrorActionPreference = 'Stop'
$Root = Resolve-Path (Join-Path $PSScriptRoot '..')
$RuinsDir = Join-Path $Root 'public\models\ruins'
$Tmp = Join-Path $env:TEMP 'lpp-asset-dl'
New-Item -ItemType Directory -Force -Path $RuinsDir, $Tmp | Out-Null

function Write-Step([string]$msg) {
  Write-Host ""
  Write-Host "==> $msg" -ForegroundColor Cyan
}

# ── 1) Kenney Mini Dungeon (CC0) — URL diretto stabile ───────────────────────
if (-not $SkipKenney) {
  Write-Step 'Kenney Mini Dungeon (CC0) — download automatico'
  $kenneyUrl = 'https://kenney.nl/media/pages/assets/mini-dungeon/6cd72dc849-1785314274/kenney_mini-dungeon.zip'
  $kenneyZip = Join-Path $Tmp 'kenney_mini-dungeon.zip'
  $kenneyExtract = Join-Path $Tmp 'kenney_mini-dungeon'

  Write-Host "GET $kenneyUrl"
  Invoke-WebRequest -Uri $kenneyUrl -OutFile $kenneyZip -UseBasicParsing
  if (Test-Path $kenneyExtract) { Remove-Item $kenneyExtract -Recurse -Force }
  Expand-Archive -Path $kenneyZip -DestinationPath $kenneyExtract -Force

  $glbSrc = Join-Path $kenneyExtract 'Models\GLB format'
  if (-not (Test-Path $glbSrc)) {
    throw "GLB non trovati in $glbSrc — struttura pack cambiata?"
  }

  # Solo moduli architettonici / props neutri (niente armi/orc/shield fantasy).
  $wanted = @(
    'barrel.glb','column.glb','gate.glb','pot.glb','rocks.glb','stones.glb','trap.glb',
    'stairs.glb','wall.glb','wall-opening.glb','wall-half.glb','wall-narrow.glb',
    'floor.glb','floor-detail.glb','dirt.glb','wood-structure.glb','wood-support.glb',
    'table.glb','banner.glb','key.glb','coin.glb','chest.glb'
  )

  $copied = 0
  foreach ($name in $wanted) {
    $from = Join-Path $glbSrc $name
    if (-not (Test-Path $from)) {
      Write-Host "  skip (assente): $name" -ForegroundColor DarkYellow
      continue
    }
    Copy-Item -Force $from (Join-Path $RuinsDir $name)
    $copied++
    Write-Host "  + $name"
  }
  Write-Host "Kenney: $copied file → $RuinsDir" -ForegroundColor Green
} else {
  Write-Step 'Kenney Mini Dungeon — SKIP'
}

# ── 2) Quaternius Ultimate Modular Ruins (CC0) — manuale ─────────────────────
Write-Step 'Quaternius Ultimate Modular Ruins (CC0)'

$quaterniusDest = Join-Path $Root 'public\models\quaternius-ruins'
New-Item -ItemType Directory -Force -Path $quaterniusDest | Out-Null

if ($QuaterniusZip -and (Test-Path $QuaterniusZip)) {
  Write-Host "Import da ZIP: $QuaterniusZip"
  $qx = Join-Path $Tmp 'quaternius-ruins-extract'
  if (Test-Path $qx) { Remove-Item $qx -Recurse -Force }
  Expand-Archive -Path $QuaterniusZip -DestinationPath $qx -Force
  $models = Get-ChildItem $qx -Recurse -Include *.glb,*.gltf,*.fbx,*.obj
  Write-Host "Trovati $($models.Count) modelli. Copio GLB/GLTF (se presenti)…"
  $n = 0
  foreach ($m in $models) {
    if ($m.Extension -in '.glb', '.gltf') {
      Copy-Item -Force $m.FullName (Join-Path $quaterniusDest $m.Name)
      $n++
    }
  }
  if ($n -eq 0) {
    Write-Host @"

ATTENZIONE: il pack Quaternius è in FBX/OBJ/Blend (non GLB).
Converti con Blender o:
  # esempio batch (richiede gltf-transform + asset già in glTF)
  Get-ChildItem '$qx' -Recurse -Filter *.fbx

Oppure apri Blender → File → Import FBX → Export glTF Binary (.glb)
poi copia i .glb in: $quaterniusDest

"@ -ForegroundColor Yellow
  } else {
    Write-Host "Quaternius: $n GLB/GLTF → $quaterniusDest" -ForegroundColor Green
  }
} elseif ($QuaterniusFolder -and (Test-Path $QuaterniusFolder)) {
  Write-Host "Import da cartella: $QuaterniusFolder"
  $models = Get-ChildItem $QuaterniusFolder -Recurse -Include *.glb,*.gltf
  $n = 0
  foreach ($m in $models) {
    Copy-Item -Force $m.FullName (Join-Path $quaterniusDest $m.Name)
    $n++
  }
  Write-Host "Quaternius: $n file → $quaterniusDest" -ForegroundColor Green
} else {
  Write-Host @"

MANUALE (nessun URL diretto stabile — lightbox JS / Google Drive):

  1) Apri nel browser:
     https://quaternius.com/packs/ultimatemodularruins.html
     → Download (CC0)

  2) Mirror Drive (stesso pack, CC0):
     https://drive.google.com/drive/folders/1ETp2ldaHaP0BkS4FBmkT-g9Yf88T_cIX

  3) Pack alternativo già in GLB su Poly Pizza:
     https://poly.pizza/bundle/Modular-Dungeons-Pack-HaFPqhAp3w
     → Download GLTF

  4) Poi riesegui:
     pwsh -File scripts/download-external-assets.ps1 -QuaterniusZip "`$env:USERPROFILE\Downloads\<file>.zip"
     # oppure
     pwsh -File scripts/download-external-assets.ps1 -QuaterniusFolder "D:\path\to\extracted"

"@ -ForegroundColor Yellow
}

# ── 3) Ottimizzazione opzionale ──────────────────────────────────────────────
if ($Optimize) {
  Write-Step 'Ottimizzazione meshopt (scripts/optimize-assets.mjs)'
  Push-Location $Root
  try {
    node scripts/optimize-assets.mjs
  } finally {
    Pop-Location
  }
}

Write-Step 'Fatto'
Write-Host "Ruins attuali:"
Get-ChildItem $RuinsDir -Filter *.glb | Sort-Object Name | ForEach-Object {
  '{0,8:N0}  {1}' -f $_.Length, $_.Name
}
Write-Host ""
Write-Host "Attribuzione: Kenney.nl (CC0). Quaternius CC0 se importato." -ForegroundColor DarkGray
