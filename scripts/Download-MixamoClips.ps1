<#
.SYNOPSIS
  Mixamo (Adobe) - checklist + import FBX. NON scarica da Mixamo in automatico.

.DESCRIPTION
  Mixamo NON ha un'API pubblica per il download massivo senza login Adobe.
  Questo script NON fa scraping, NON ruba cookie e NON chiede la password.

  Cosa fa:
    1) Apre https://www.mixamo.com nel browser predefinito
    2) Stampa la checklist italiana (personaggio + clip per nemico)
    3) Crea assets\mixamo-incoming\ dove DROPPATE gli FBX
    4) Con -Import (default) copia/converte gli FBX gia presenti
    5) Opzionale -WatchSeconds: resta in ascolto della cartella incoming
    6) Chiama scripts\Convert-FbxToGlb.ps1 se Blender e presente

  Login Mixamo (ufficiale):
    - Account Adobe ID gratuito: https://www.adobe.com
    - Poi accedi su https://www.mixamo.com  (stesso ID)
    - Personaggio consigliato: "Y Bot" (o "X Bot") - retarget facile
    - Download: Format = FBX for Unity (*.fbx), FPS = 30
      Skin = With Skin se e un personaggio nuovo
      Skin = Without Skin se attacchi clip a un GLB gia in repo

  Come eseguire (PowerShell 5.1 o 7):
    cd F:\LaPiramidePerduta
    pwsh -File scripts\Download-MixamoClips.ps1
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\Download-MixamoClips.ps1

    Solo checklist + apri browser (nessuna conversione):
    pwsh -File scripts\Download-MixamoClips.ps1 -SkipImport

    Resta in ascolto 10 minuti:
    pwsh -File scripts\Download-MixamoClips.ps1 -WatchSeconds 600

.EXAMPLE
  pwsh -File scripts\Download-MixamoClips.ps1
.EXAMPLE
  pwsh -File scripts\Download-MixamoClips.ps1 -IncomingDir .\assets\mixamo-incoming -WatchSeconds 300
#>
[CmdletBinding()]
param(
    [string]$IncomingDir = '',
    [string]$RawOutDir = '',
    [int]$WatchSeconds = 0,
    [switch]$SkipBrowser,
    [switch]$SkipImport,
    [switch]$SkipConvert,
    [string]$BlenderExe = 'C:\Program Files\Blender Foundation\Blender 4.2\blender.exe'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
if (-not $IncomingDir) {
    $IncomingDir = Join-Path $Root 'assets\mixamo-incoming'
}
if (-not $RawOutDir) {
    $RawOutDir = Join-Path $Root 'public\assets\enemies\raw'
}

$ConvertScript = Join-Path $PSScriptRoot 'Convert-FbxToGlb.ps1'
$EnemyDir = Join-Path $Root 'public\assets\enemies'

function Write-Step {
    param([string]$Message)
    Write-Host ''
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Show-MixamoChecklist {
    Write-Host @'

  La Piramide Perduta - Mixamo (Adobe)
  ------------------------------------
  Mixamo NON permette il download FBX senza account. Login Adobe ID (gratis).
  Nessuno script puo scaricare le clip al posto tuo: Adobe lo vieta.

  1. Apri  https://www.mixamo.com  e accedi con Adobe ID
  2. Scheda CHARACTERS -> cerca "Y Bot" -> Click -> Use this character
     (poi retarget sulle mesh del gioco: priest / shabti / mummy / anubis)
  3. Scheda ANIMATIONS -> scarica UNA clip alla volta (Download)

  Impostazioni Download (finestra Mixamo):
     Format .............. FBX for Unity (*.fbx)
     Frames per second ... 30
     Skin ................ WITH SKIN     se vuoi un personaggio NUOVO
                           WITHOUT SKIN  se attacchi la clip a un GLB gia in repo
     Keyframe Reduction .. none (o Uniform)

  Rinomina i file COSI prima di dropparli in assets\mixamo-incoming\

'@ -ForegroundColor Yellow

    $rows = @(
        @{ Enemy = 'priest'; Mixamo = 'Idle'; File = 'priest_idle.fbx' }
        @{ Enemy = 'priest'; Mixamo = 'Walking'; File = 'priest_walk.fbx' }
        @{ Enemy = 'priest'; Mixamo = 'Punch  (o Standing Melee Attack)'; File = 'priest_attack.fbx' }
        @{ Enemy = 'priest'; Mixamo = 'Death'; File = 'priest_death.fbx' }
        @{ Enemy = 'shabti'; Mixamo = 'Idle'; File = 'shabti_idle.fbx' }
        @{ Enemy = 'shabti'; Mixamo = 'Walking'; File = 'shabti_walk.fbx' }
        @{ Enemy = 'shabti'; Mixamo = 'Punch  (o Standing Melee Attack)'; File = 'shabti_attack.fbx' }
        @{ Enemy = 'shabti'; Mixamo = 'Death'; File = 'shabti_death.fbx' }
        @{ Enemy = 'mummy'; Mixamo = 'Zombie Idle'; File = 'mummy_idle.fbx' }
        @{ Enemy = 'mummy'; Mixamo = 'Zombie Walk'; File = 'mummy_walk.fbx' }
        @{ Enemy = 'mummy'; Mixamo = 'Zombie Attack  (o Punch)'; File = 'mummy_attack.fbx' }
        @{ Enemy = 'mummy'; Mixamo = 'Zombie Death'; File = 'mummy_death.fbx' }
        @{ Enemy = 'anubis'; Mixamo = 'Idle'; File = 'anubis_idle.fbx' }
        @{ Enemy = 'anubis'; Mixamo = 'Walking'; File = 'anubis_walk.fbx' }
        @{ Enemy = 'anubis'; Mixamo = 'Punch  (o Sword And Shield Slash)'; File = 'anubis_attack.fbx' }
        @{ Enemy = 'anubis'; Mixamo = 'Death'; File = 'anubis_death.fbx' }
        @{ Enemy = 'sobek'; Mixamo = 'NON umanoide Mixamo (quadrupede)'; File = '(respiro procedurale)' }
    )

    Write-Host ('  {0,-10} {1,-42} {2}' -f 'NEMICO', 'CERCA SU MIXAMO', 'NOME FILE') -ForegroundColor Green
    Write-Host ('  {0,-10} {1,-42} {2}' -f '------', '---------------', '---------')
    foreach ($r in $rows) {
        Write-Host ('  {0,-10} {1,-42} {2}' -f $r.Enemy, $r.Mixamo, $r.File)
    }

    Write-Host @'

  Hit-react (opzionale, tutti gli umanoidi):
     Hit React  ->  priest_hit.fbx / shabti_hit.fbx / mummy_hit.fbx / anubis_hit.fbx

  Scarab / cobra / sobek: NON sono umanoidi Mixamo. Restano animazione
  procedurale (respiro) finche non hai clip dedicate. NON inventare FBX.

  Personaggio intero CON skin (sostituisce il GLB nemico):
     priest.fbx  shabti.fbx  mummy.fbx  anubis.fbx
     -> convertiti e copiati in public\assets\enemies\<nome>.glb (con backup)
     anubis.fbx  ->  public\assets\enemies\anubis_executioner.glb

'@ -ForegroundColor DarkGray
}

function Get-EnemyBaseName {
    param([string]$BaseName)
    $n = $BaseName.ToLowerInvariant()
    $map = @{
        'priest' = 'priest'
        'shabti' = 'shabti'
        'mummy'  = 'mummy'
        'anubis' = 'anubis_executioner'
        'anubis_executioner' = 'anubis_executioner'
        'royal_mummy' = 'royal_mummy'
        'royal'  = 'royal_mummy'
    }
    if ($map.ContainsKey($n)) { return $map[$n] }
    foreach ($key in @('priest', 'shabti', 'mummy', 'anubis', 'royal')) {
        if ($n.StartsWith($key + '_') -or $n.StartsWith($key + '-')) {
            return $map[$key]
        }
    }
    return $null
}

function Backup-IfExists {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return }
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $bak = "$Path.bak-$stamp"
    Copy-Item -LiteralPath $Path -Destination $bak -Force
    Write-Host "  backup: $bak" -ForegroundColor DarkGray
}

function Import-IncomingFbx {
    if (-not (Test-Path -LiteralPath $IncomingDir)) {
        Write-Host "Cartella incoming vuota/assente: $IncomingDir" -ForegroundColor Yellow
        return 0
    }
    $files = @(Get-ChildItem -LiteralPath $IncomingDir -Filter '*.fbx' -File -ErrorAction SilentlyContinue)
    if ($files.Count -eq 0) {
        Write-Host "Nessun .fbx in $IncomingDir - droppa i file Mixamo e rilancia, oppure usa -WatchSeconds." -ForegroundColor Yellow
        return 0
    }

    New-Item -ItemType Directory -Force -Path $RawOutDir | Out-Null
    Write-Step "Import $($files.Count) FBX -> $RawOutDir"

    if (-not $SkipConvert) {
        if (-not (Test-Path -LiteralPath $ConvertScript)) {
            Write-Host "Convert-FbxToGlb.ps1 mancante: $ConvertScript" -ForegroundColor Red
            Write-Host "Copia comunque gli FBX in incoming; converti a mano o installa Blender." -ForegroundColor Yellow
        } elseif (-not (Test-Path -LiteralPath $BlenderExe)) {
            Write-Host "Blender non trovato: $BlenderExe" -ForegroundColor Yellow
            Write-Host "Installa Blender 4.2 oppure passa -BlenderExe. Gli FBX restano in incoming." -ForegroundColor Yellow
        } else {
            Write-Host "Chiamo Convert-FbxToGlb.ps1 (processo separato)..." -ForegroundColor Cyan
            $psExe = 'powershell.exe'
            if (Get-Command pwsh -ErrorAction SilentlyContinue) {
                $psExe = (Get-Command pwsh).Source
            }
            $argList = @(
                '-NoProfile', '-ExecutionPolicy', 'Bypass',
                '-File', $ConvertScript,
                '-InputDir', $IncomingDir,
                '-OutputDir', $RawOutDir,
                '-BlenderExe', $BlenderExe
            )
            $p = Start-Process -FilePath $psExe -ArgumentList $argList -Wait -PassThru -NoNewWindow
            if ($p.ExitCode -ne 0) {
                Write-Host "Conversione FBX uscita $($p.ExitCode) - controlla Blender / log sopra." -ForegroundColor Yellow
            }
        }
    }

    $copied = 0
    New-Item -ItemType Directory -Force -Path $EnemyDir | Out-Null
    foreach ($fbx in $files) {
        $enemy = Get-EnemyBaseName -BaseName $fbx.BaseName
        $glbRaw = Join-Path $RawOutDir ($fbx.BaseName + '.glb')
        $bn = $fbx.BaseName.ToLowerInvariant()
        $isWholeCharacter = $false
        if ($bn -eq 'priest' -or $bn -eq 'shabti' -or $bn -eq 'mummy' -or $bn -eq 'anubis' -or $bn -eq 'anubis_executioner' -or $bn -eq 'royal_mummy') {
            $isWholeCharacter = $true
        }
        if ($isWholeCharacter -and $enemy -and (Test-Path -LiteralPath $glbRaw)) {
            $dest = Join-Path $EnemyDir ($enemy + '.glb')
            Backup-IfExists -Path $dest
            Copy-Item -LiteralPath $glbRaw -Destination $dest -Force
            Write-Host "  GLB nemico: $dest" -ForegroundColor Green
            $copied++
        } elseif (Test-Path -LiteralPath $glbRaw) {
            Write-Host "  clip convertita: $glbRaw  (da fondere nel GLB del nemico in Blender, oppure tieni in raw/)" -ForegroundColor DarkGray
        }
    }
    return $copied
}

# --- main --------------------------------------------------------------------
Write-Host ''
Write-Host "  Download-MixamoClips.ps1  (PS $($PSVersionTable.PSVersion))" -ForegroundColor Cyan
Write-Host "  Incoming: $IncomingDir"

New-Item -ItemType Directory -Force -Path $IncomingDir | Out-Null
$readmeIncoming = Join-Path $IncomingDir 'DROPPATE-FBX-QUI.txt'
if (-not (Test-Path -LiteralPath $readmeIncoming)) {
    @(
        'Droppate qui gli FBX scaricati da mixamo.com (Adobe ID).'
        'Nomi: priest_idle.fbx, priest_walk.fbx, priest_attack.fbx, priest_death.fbx'
        '      shabti_*.fbx, mummy_*.fbx, anubis_*.fbx'
        'Poi:  pwsh -File scripts\Download-MixamoClips.ps1'
    ) | Set-Content -LiteralPath $readmeIncoming -Encoding UTF8
}

Show-MixamoChecklist

if (-not $SkipBrowser) {
    Write-Step 'Apro Mixamo nel browser (login Adobe ID richiesto)'
    try {
        Start-Process 'https://www.mixamo.com'
    } catch {
        Write-Host "Impossibile aprire il browser: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host 'Apri a mano: https://www.mixamo.com' -ForegroundColor Yellow
    }
}

if (-not $SkipImport) {
    [void](Import-IncomingFbx)
}

if ($WatchSeconds -gt 0) {
    Write-Step "Watch $WatchSeconds s su $IncomingDir  (Ctrl+C per uscire)"
    $deadline = (Get-Date).AddSeconds($WatchSeconds)
    $seen = @{}
    foreach ($f in @(Get-ChildItem -LiteralPath $IncomingDir -Filter '*.fbx' -File -ErrorAction SilentlyContinue)) {
        $seen[$f.Name] = $true
    }
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 3
        foreach ($f in @(Get-ChildItem -LiteralPath $IncomingDir -Filter '*.fbx' -File -ErrorAction SilentlyContinue)) {
            if (-not $seen.ContainsKey($f.Name)) {
                $seen[$f.Name] = $true
                Write-Host "Nuovo FBX: $($f.Name)" -ForegroundColor Green
                if (-not $SkipImport) { [void](Import-IncomingFbx) }
            }
        }
    }
    Write-Host 'Watch terminato.' -ForegroundColor DarkGray
}

Write-Step 'Fatto'
Write-Host "1. Login Adobe su mixamo.com"
Write-Host "2. Scarica le clip (tabella sopra) in: $IncomingDir"
Write-Host "3. Rilancia questo script (o usa -WatchSeconds mentre scarichi)"
Write-Host "4. Clip GLB: $RawOutDir"
Write-Host "5. Personaggi interi (priest.fbx, ...) -> $EnemyDir"
Write-Host ''
