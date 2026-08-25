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

# ── 2) Quaternius Ultimate Modular Ruins (CC0) — import se path valido ───────
Write-Step 'Quaternius Ultimate Modular Ruins (CC0)'

$quaterniusDest = Join-Path $Root 'public\models\quaternius-ruins'
New-Item -ItemType Directory -Force -Path $quaterniusDest | Out-Null

if ($QuaterniusZip) {
  if (-not (Test-Path -LiteralPath $QuaterniusZip)) {
    throw @"
QuaterniusZip non trovato:
  $QuaterniusZip

Devi prima scaricare il pack nel browser, poi passare il path REALE del file.
Esempi tipici dopo il download:
  Get-ChildItem `$env:USERPROFILE\Downloads -Filter *.zip | Sort-Object LastWriteTime -Descending | Select-Object -First 10

Poi:
  pwsh -File scripts\download-external-assets.ps1 -SkipKenney -QuaterniusZip "`$env:USERPROFILE\Downloads\<nome-reale>.zip"
"@
  }
  Write-Host "Import da ZIP: $QuaterniusZip"
  $qx = Join-Path $Tmp 'quaternius-ruins-extract'
  if (Test-Path $qx) { Remove-Item $qx -Recurse -Force }
  Expand-Archive -LiteralPath $QuaterniusZip -DestinationPath $qx -Force
  $models = @(Get-ChildItem $qx -Recurse -Include *.glb,*.gltf,*.fbx,*.obj -File)
  Write-Host "Trovati $($models.Count) modelli (glb/gltf/fbx/obj)."
  $n = 0
  foreach ($m in $models) {
    if ($m.Extension -in '.glb', '.gltf') {
      Copy-Item -Force $m.FullName (Join-Path $quaterniusDest $m.Name)
      $n++
    }
  }
  if ($n -eq 0) {
    $fbxCount = @($models | Where-Object { $_.Extension -in '.fbx', '.obj' }).Count
    Write-Host @"

ATTENZIONE: nessun .glb/.gltf nello ZIP ($fbxCount file FBX/OBJ).
Ultimate Modular Ruins ufficiale è FBX/OBJ/Blend — serve conversione Blender:
  Import FBX → Export glTF Binary (.glb) → cartella $quaterniusDest

Alternativa già in GLB: Poly Pizza Modular Dungeons
  https://poly.pizza/bundle/Modular-Dungeons-Pack-HaFPqhAp3w → Download GLTF
  poi: -QuaterniusZip o -QuaterniusFolder sul pack scaricato

"@ -ForegroundColor Yellow
  } else {
    Write-Host "Quaternius: $n GLB/GLTF → $quaterniusDest" -ForegroundColor Green
  }
} elseif ($QuaterniusFolder) {
  if (-not (Test-Path -LiteralPath $QuaterniusFolder)) {
    throw @"
QuaterniusFolder non trovato:
  $QuaterniusFolder

Verifica il path (D:\Downloads non esiste su questa macchina).
Elenca Downloads:
  Get-ChildItem `$env:USERPROFILE\Downloads | Sort-Object LastWriteTime -Descending | Select-Object -First 20
"@
  }
  Write-Host "Import da cartella: $QuaterniusFolder"
  $models = @(Get-ChildItem -LiteralPath $QuaterniusFolder -Recurse -Include *.glb,*.gltf -File)
  $n = 0
  foreach ($m in $models) {
    Copy-Item -Force $m.FullName (Join-Path $quaterniusDest $m.Name)
    $n++
  }
  if ($n -eq 0) {
    Write-Host "Nessun .glb/.gltf in $QuaterniusFolder (solo FBX? converti in Blender)." -ForegroundColor Yellow
  } else {
    Write-Host "Quaternius: $n file → $quaterniusDest" -ForegroundColor Green
  }
} else {
  Write-Host @"

MANUALE — scarica PRIMA, poi riesegui con il path reale:

  1) https://quaternius.com/packs/ultimatemodularruins.html → Download
     (oppure Drive: https://drive.google.com/drive/folders/1ETp2ldaHaP0BkS4FBmkT-g9Yf88T_cIX)

  2) Meglio per GLB pronti:
     https://poly.pizza/bundle/Modular-Dungeons-Pack-HaFPqhAp3w → Download GLTF

  3) Trova il file:
     Get-ChildItem `$env:USERPROFILE\Downloads -Filter *.zip | Sort LastWriteTime -Descending

  4) Importa (salta Kenney se già fatto):
     pwsh -File scripts\download-external-assets.ps1 -SkipKenney -QuaterniusZip "`$env:USERPROFILE\Downloads\<nome>.zip"

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
