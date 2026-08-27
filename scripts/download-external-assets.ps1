<#
.SYNOPSIS
  Asset esterni per La Piramide Perduta — PIRAMIDE egizia, non dungeon medievale.

.DESCRIPTION
  Identità: Egyptian Noir / piramide funeraria.
  NON usare pack Quaternius "Modular Dungeons" / "Ultimate Modular Ruins"
  (tag Medieval) né props Kenney da taverna (barrel, banner, wood, chest, gate).

  Già in gioco (egizi):
    public/assets/landmarks/  — Anubi, obelisco, sarcofago, geroglifici (ToxSam CC0)
    public/assets/enemies/    — scarabeo, mummia, cobra, Sobek, …
    Colonne procedurali papiriformi (EgyptianColumn.ts)
    Soglie procedurali (stipiti + architrave dorato)

  Questo script:
    -Opzionale: -KenneyStoneOnly → solo pot/rocks/stones/stairs/dirt/floor
    -Importa cartelle/zip EGIZIE se le fornisci (-EgyptianFolder / -EgyptianZip)

.EXAMPLE
  pwsh -File scripts/download-external-assets.ps1 -KenneyStoneOnly

.EXAMPLE
  pwsh -File scripts/download-external-assets.ps1 -SkipKenney `
    -EgyptianFolder "$env:USERPROFILE\Downloads\egyptian-glbs"
#>
[CmdletBinding()]
param(
  [string]$EgyptianZip = '',
  [string]$EgyptianFolder = '',
  # Alias legacy
  [string]$QuaterniusZip = '',
  [string]$QuaterniusFolder = '',
  [switch]$SkipKenney,
  [switch]$KenneyStoneOnly,
  [switch]$Optimize
)

$ErrorActionPreference = 'Stop'
$Root = Resolve-Path (Join-Path $PSScriptRoot '..')
$RuinsDir = Join-Path $Root 'public\models\ruins'
$EgyptianDest = Join-Path $Root 'public\models\egyptian'
$Tmp = Join-Path $env:TEMP 'lpp-asset-dl'
New-Item -ItemType Directory -Force -Path $RuinsDir, $EgyptianDest, $Tmp | Out-Null

if ($QuaterniusZip -and -not $EgyptianZip) { $EgyptianZip = $QuaterniusZip }
if ($QuaterniusFolder -and -not $EgyptianFolder) { $EgyptianFolder = $QuaterniusFolder }

function Write-Step([string]$msg) {
  Write-Host ""
  Write-Host "==> $msg" -ForegroundColor Cyan
}

Write-Host @"

  La Piramide Perduta — asset EGIZI
  ─────────────────────────────────
  NO:  Quaternius Modular Dungeons / Ultimate Modular Ruins (Medieval)
  NO:  Kenney barrel, banner, wood, chest, gate (taverna/dungeon)
  SI:  ToxSam landmarks già in public/assets/landmarks/
  SI:  Poly Pizza / Sketchfab filtrati egyptian + CC0/CC-BY
  SI:  colonne + soglie procedurali egizie

"@ -ForegroundColor DarkYellow

# ── 1) Kenney: solo pietra neutra (esplicito -KenneyStoneOnly) ───────────────
if ($KenneyStoneOnly -and -not $SkipKenney) {
  Write-Step 'Kenney Mini Dungeon — SOLO moduli pietra neutri (filler)'
  $kenneyUrl = 'https://kenney.nl/media/pages/assets/mini-dungeon/6cd72dc849-1785314274/kenney_mini-dungeon.zip'
  $kenneyZip = Join-Path $Tmp 'kenney_mini-dungeon.zip'
  $kenneyExtract = Join-Path $Tmp 'kenney_mini-dungeon'
  Write-Host "GET $kenneyUrl"
  Invoke-WebRequest -Uri $kenneyUrl -OutFile $kenneyZip -UseBasicParsing
  if (Test-Path $kenneyExtract) { Remove-Item $kenneyExtract -Recurse -Force }
  Expand-Archive -Path $kenneyZip -DestinationPath $kenneyExtract -Force
  $glbSrc = Join-Path $kenneyExtract 'Models\GLB format'
  $wanted = @('pot.glb','rocks.glb','stones.glb','column.glb','stairs.glb','dirt.glb','floor.glb','floor-detail.glb')
  $copied = 0
  foreach ($name in $wanted) {
    $from = Join-Path $glbSrc $name
    if (-not (Test-Path $from)) { continue }
    Copy-Item -Force $from (Join-Path $RuinsDir $name)
    $copied++
    Write-Host "  + $name"
  }
  Write-Host "Kenney pietra: $copied file → $RuinsDir" -ForegroundColor Green
} elseif ($SkipKenney) {
  Write-Step 'Kenney — SKIP'
} else {
  Write-Step 'Kenney dungeon pack — non scaricato (fuori tema piramide)'
  Write-Host "Per filler pietra neutro: -KenneyStoneOnly" -ForegroundColor DarkGray
}

# ── 2) Import pack EGIZIO fornito dall'utente ────────────────────────────────
Write-Step 'Import asset egizi (ToxSam / Poly Pizza egyptian / Sketchfab CC0)'

if ($EgyptianZip) {
  if (-not (Test-Path -LiteralPath $EgyptianZip)) {
    throw "EgyptianZip non trovato: $EgyptianZip"
  }
  Write-Host "Import da ZIP: $EgyptianZip"
  $qx = Join-Path $Tmp 'egyptian-extract'
  if (Test-Path $qx) { Remove-Item $qx -Recurse -Force }
  Expand-Archive -LiteralPath $EgyptianZip -DestinationPath $qx -Force
  $models = @(Get-ChildItem $qx -Recurse -Include *.glb,*.gltf -File)
  $n = 0
  foreach ($m in $models) {
    Copy-Item -Force $m.FullName (Join-Path $EgyptianDest $m.Name)
    $n++
  }
  if ($n -eq 0) {
    Write-Host "Nessun .glb/.gltf nello ZIP. Se è FBX (Quaternius Ruins medievale): pack SBAGLIATO per la piramide." -ForegroundColor Yellow
  } else {
    Write-Host "Egizi: $n GLB/GLTF → $EgyptianDest" -ForegroundColor Green
    Write-Host "Registra i path in ArtifactRegistry / content/assets.ts per usarli in scena." -ForegroundColor DarkGray
  }
} elseif ($EgyptianFolder) {
  if (-not (Test-Path -LiteralPath $EgyptianFolder)) {
    throw "EgyptianFolder non trovato: $EgyptianFolder"
  }
  $models = @(Get-ChildItem -LiteralPath $EgyptianFolder -Recurse -Include *.glb,*.gltf -File)
  $n = 0
  foreach ($m in $models) {
    Copy-Item -Force $m.FullName (Join-Path $EgyptianDest $m.Name)
    $n++
  }
  Write-Host "Egizi: $n file → $EgyptianDest" -ForegroundColor Green
} else {
  Write-Host @"

Fonti EGIZIE consigliate (non dungeon):

  • Già nel gioco: public/assets/landmarks/ (Anubi, obelisco, sarcofago, geroglifici)
  • ToxSam Egyptian temples (CC0):
    https://github.com/ToxSam/open-source-3D-assets
  • Poly Pizza search "egyptian" / "anubis" / "obelisk" / "pyramid" (filtra CC0/CC-BY)
  • OpenGameArt ancient-egypt texture/geroglifici (già usati in textures/)

  NON scaricare:
  • quaternius.com/.../modulardungeon.html
  • quaternius.com/.../ultimatemodularruins.html  (tag: Medieval)
  • poly.pizza Modular Dungeons Pack

  Dopo aver scaricato GLB egizi:
    pwsh -File scripts\download-external-assets.ps1 -SkipKenney `
      -EgyptianFolder "`$env:USERPROFILE\Downloads\<cartella-egizia>"

"@ -ForegroundColor Yellow
}

if ($Optimize) {
  Write-Step 'Ottimizzazione meshopt (scripts/optimize-assets.mjs)'
  Push-Location $Root
  try { node scripts/optimize-assets.mjs } finally { Pop-Location }
}

Write-Step 'Fatto'
Write-Host "Landmarks egizi: public/assets/landmarks/"
Write-Host "Import egizi:     $EgyptianDest"
Write-Host "Filler pietra:    $RuinsDir (solo pot/rocks/… se -KenneyStoneOnly)"
