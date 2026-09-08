<#
.SYNOPSIS
  Scarica una mesh Anubi DISTINTA (CC0 / Open Access) per ANUBIS_EXECUTIONER.

.DESCRIPTION
  Destinazione: public\assets\enemies\anubis_executioner.glb
  (e li che il gioco la carica - NON e public\models\).

  Smithsonian 3D (3d.si.edu) e Open Access / CC0 quando il badge CC0 e visibile.
  Pagina usata in precedenza nel repo (ORA 404):
    https://3d.si.edu/object/3d/anubis-statue:c8de4a6e-4ba3-11ea-b3bb-0eba7659d99b
  UUID: c8de4a6e-4ba3-11ea-b3bb-0eba7659d99b

  L'API 3d-api.si.edu per q=anubis restituisce "Papio anubis" (teschi di babbuino),
  NON il dio egizio. Questo script li SCARTA.

  Cosa fa:
    1) Prova l'API file-search Smithsonian (GLB, filtro Papio/cranium)
    2) Prova il document.json dell'UUID storico (se 404, ok)
    3) Prova il registry ToxSam CC0 (JSON pubblico) cercando "anubis"
       - se l'MD5 coincide con statue_anubis.glb (duplicato G-30) lo scarta
    4) Apre 3d.si.edu / explore nel browser per il download manuale
    5) Accetta -LocalGlb se hai gia il file (Smithsonian / Sketchfab CC0)

  Prima di sovrascrivere: backup  anubis_executioner.glb.bak-YYYYMMDD-HHMMSS
  Verifica: dimensione >= MinBytes e magic glTF.

  Come eseguire (PowerShell 5.1 o 7):
    cd F:\LaPiramidePerduta
    pwsh -File scripts\Download-AnubisMesh.ps1
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\Download-AnubisMesh.ps1

    File gia scaricato a mano:
    pwsh -File scripts\Download-AnubisMesh.ps1 -LocalGlb "$env:USERPROFILE\Downloads\anubis.glb"

.EXAMPLE
  pwsh -File scripts\Download-AnubisMesh.ps1
.EXAMPLE
  pwsh -File scripts\Download-AnubisMesh.ps1 -LocalGlb .\anubis_cc0.glb
#>
[CmdletBinding()]
param(
    [string]$LocalGlb = '',
    [string]$OutFile = '',
    [int]$MinBytes = 8192,
    [switch]$SkipBrowser,
    [switch]$SkipNetwork
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$EnemyDir = Join-Path $Root 'public\assets\enemies'
if (-not $OutFile) {
    $OutFile = Join-Path $EnemyDir 'anubis_executioner.glb'
}
$StatueFile = Join-Path $Root 'public\assets\landmarks\statue_anubis.glb'
$TmpDir = Join-Path $env:TEMP 'lpp-anubis-dl'

# UUID documentato in piramide-audit.html (pagina 3d.si.edu 404 al 2026-08-27).
$SmithsonianAnubisUuid = 'c8de4a6e-4ba3-11ea-b3bb-0eba7659d99b'
$SmithsonianObjectPage = "https://3d.si.edu/object/3d/anubis-statue:$SmithsonianAnubisUuid"

function Write-Step {
    param([string]$Message)
    Write-Host ''
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Get-FileMd5 {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    $hash = Get-FileHash -LiteralPath $Path -Algorithm MD5
    return $hash.Hash
}

function Backup-IfExists {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $bak = "$Path.bak-$stamp"
    Copy-Item -LiteralPath $Path -Destination $bak -Force
    Write-Host "  backup esistente -> $bak" -ForegroundColor DarkGray
    return $bak
}

function Test-GlbLooksValid {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return $false }
    $item = Get-Item -LiteralPath $Path
    if ($item.Length -lt $MinBytes) {
        Write-Host "  file troppo piccolo ($($item.Length) byte) - probabilmente HTML di errore" -ForegroundColor Yellow
        return $false
    }
    $fs = [System.IO.File]::Open($Path, 'Open', 'Read', 'Read')
    try {
        $buf = New-Object byte[] 4
        [void]$fs.Read($buf, 0, 4)
        $magic = [System.Text.Encoding]::ASCII.GetString($buf)
        if ($magic -ne 'glTF') {
            Write-Host "  magic '$magic' != glTF - non e un GLB" -ForegroundColor Yellow
            return $false
        }
    } finally {
        $fs.Close()
    }
    return $true
}

function Save-ToDestination {
    param([string]$SourcePath)
    if (-not (Test-GlbLooksValid -Path $SourcePath)) {
        Write-Host "  skip: file non valido ($SourcePath)" -ForegroundColor Yellow
        return $false
    }
    $srcHash = Get-FileMd5 -Path $SourcePath
    $statueHash = Get-FileMd5 -Path $StatueFile
    if ($srcHash -and $statueHash -and ($srcHash -eq $statueHash)) {
        Write-Host "  ATTENZIONE: MD5 identico a statue_anubis.glb (duplicato G-30)." -ForegroundColor Red
        Write-Host "  Non lo copio come executioner. Serve una mesh DIVERSA (Smithsonian / altro CC0)." -ForegroundColor Red
        return $false
    }
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $OutFile) | Out-Null
    Backup-IfExists -Path $OutFile | Out-Null
    Copy-Item -LiteralPath $SourcePath -Destination $OutFile -Force
    $len = (Get-Item -LiteralPath $OutFile).Length
    Write-Host "  OK -> $OutFile  ($len byte, MD5 $srcHash)" -ForegroundColor Green
    return $true
}

function Get-JsonProp {
    param($Object, [string]$Name)
    if ($null -eq $Object) { return $null }
    $p = $Object.PSObject.Properties[$Name]
    if ($null -eq $p) { return $null }
    return $p.Value
}

function Test-IsEgyptianAnubisTitle {
    param([string]$Title)
    $low = $Title.ToLowerInvariant()
    # Papio anubis = babbuino olive, NON il dio Anubi.
    if ($low -match 'papio') { return $false }
    if ($low -match 'cranium' -or $low -match 'mandible' -or $low -match 'skull') { return $false }
    if ($low -match 'anubis' -and ($low -match 'egypt' -or $low -match 'statue' -or $low -match 'jackal' -or $low -match 'god')) {
        return $true
    }
    if ($low -match 'anubis statue' -or $low -match 'statue of anubis') { return $true }
    return $false
}

function Try-DownloadUrl {
    param([string]$Url, [string]$Dest)
    Write-Host "  GET $Url"
    try {
        Invoke-WebRequest -Uri $Url -OutFile $Dest -UseBasicParsing -TimeoutSec 120
        return $true
    } catch {
        Write-Host "  fallito: $($_.Exception.Message)" -ForegroundColor DarkGray
        return $false
    }
}

function Search-SmithsonianAnubis {
    $hits = New-Object System.Collections.Generic.List[string]

    $searchUrls = @(
        'https://3d-api.si.edu/api/v1.0/content/file/search?q=anubis%20statue&file_type=glb',
        'https://3d-api.si.edu/api/v1.0/content/file/search?q=egyptian%20anubis&file_type=glb',
        'https://3d-api.si.edu/api/v1.0/content/file/search?q=anubis&file_type=glb'
    )
    foreach ($url in $searchUrls) {
        Write-Host "  API $url"
        try {
            $resp = Invoke-RestMethod -Uri $url -UseBasicParsing -TimeoutSec 40
        } catch {
            Write-Host "  API non disponibile: $($_.Exception.Message)" -ForegroundColor DarkGray
            continue
        }
        $rows = @()
        $rowsProp = Get-JsonProp -Object $resp -Name 'rows'
        if ($rowsProp) { $rows = @($rowsProp) }
        $kept = 0
        $skippedPapio = 0
        foreach ($row in $rows) {
            $title = [string](Get-JsonProp -Object $row -Name 'title')
            if (-not (Test-IsEgyptianAnubisTitle -Title $title)) {
                if ($title.ToLowerInvariant() -match 'papio') { $skippedPapio++ }
                continue
            }
            $content = Get-JsonProp -Object $row -Name 'content'
            $uri = [string](Get-JsonProp -Object $content -Name 'uri')
            if ($uri -and ($uri -match '\.glb')) {
                Write-Host "  hit Smithsonian: $title" -ForegroundColor Green
                [void]$hits.Add($uri)
                $kept++
            }
        }
        if ($skippedPapio -gt 0) {
            Write-Host "  scartati $skippedPapio risultati Papio anubis (babbuino, non il dio)." -ForegroundColor DarkGray
        }
        if ($kept -eq 0) {
            Write-Host "  nessun GLB del dio Anubi in questa query." -ForegroundColor DarkGray
        }
    }

    # Document.json dell'UUID storico (piramide-audit.html). 404 atteso.
    $docUrls = @(
        "https://3d-api.si.edu/content/document/3d_package:$SmithsonianAnubisUuid/document.json",
        "https://3d-api.si.edu/content/document/$SmithsonianAnubisUuid/document.json"
    )
    foreach ($docUrl in $docUrls) {
        Write-Host "  UUID storico GET $docUrl"
        try {
            $doc = Invoke-RestMethod -Uri $docUrl -UseBasicParsing -TimeoutSec 40
            $blob = ($doc | ConvertTo-Json -Depth 12)
            $glbMatches = [regex]::Matches($blob, 'https://[^"\\]+\.glb')
            foreach ($m in $glbMatches) {
                Write-Host "  GLB da document.json: $($m.Value)" -ForegroundColor Green
                [void]$hits.Add($m.Value)
            }
        } catch {
            Write-Host "  UUID storico non disponibile (atteso 404): $($_.Exception.Message)" -ForegroundColor DarkGray
        }
    }

    return @($hits)
}

function Search-ToxSamAnubis {
    $projectsUrl = 'https://raw.githubusercontent.com/ToxSam/open-source-3d-assets/main/data/projects.json'
    Write-Host "  registry $projectsUrl"
    try {
        $projects = Invoke-RestMethod -Uri $projectsUrl -UseBasicParsing -TimeoutSec 40
    } catch {
        Write-Host "  ToxSam projects.json non raggiungibile: $($_.Exception.Message)" -ForegroundColor DarkGray
        return @()
    }

    $files = New-Object System.Collections.Generic.List[string]
    if ($projects -is [System.Array]) {
        foreach ($p in $projects) {
            $f = Get-JsonProp -Object $p -Name 'asset_data_file'
            if (-not $f) { $f = Get-JsonProp -Object $p -Name 'assets_file' }
            if ($f) { [void]$files.Add([string]$f) }
        }
    } else {
        $arr = Get-JsonProp -Object $projects -Name 'projects'
        if ($arr) {
            foreach ($p in @($arr)) {
                $f = Get-JsonProp -Object $p -Name 'asset_data_file'
                if ($f) { [void]$files.Add([string]$f) }
            }
        }
    }

    $hits = New-Object System.Collections.Generic.List[string]
    foreach ($rel in $files) {
        $relStr = [string]$rel
        if ($relStr -notmatch 'asset') { continue }
        $assetUrl = $relStr
        if ($assetUrl -notmatch '^https?://') {
            $assetUrl = "https://raw.githubusercontent.com/ToxSam/open-source-3d-assets/main/data/$relStr"
            if ($relStr -match '^data/') {
                $assetUrl = "https://raw.githubusercontent.com/ToxSam/open-source-3d-assets/main/$relStr"
            }
        }
        try {
            $assets = Invoke-RestMethod -Uri $assetUrl -UseBasicParsing -TimeoutSec 40
        } catch {
            continue
        }
        $list = @($assets)
        $inner = Get-JsonProp -Object $assets -Name 'assets'
        if ($inner) { $list = @($inner) }
        foreach ($a in $list) {
            $name = [string](Get-JsonProp -Object $a -Name 'name')
            if (-not $name) { $name = [string](Get-JsonProp -Object $a -Name 'title') }
            if (-not $name) { $name = [string](Get-JsonProp -Object $a -Name 'id') }
            $low = $name.ToLowerInvariant()
            if ($low -notmatch 'anubis') { continue }
            $model = Get-JsonProp -Object $a -Name 'model_file_url'
            if (-not $model) { $model = Get-JsonProp -Object $a -Name 'url' }
            if (-not $model) { $model = Get-JsonProp -Object $a -Name 'glb_url' }
            if ($model) {
                Write-Host "  hit ToxSam: $name" -ForegroundColor Green
                [void]$hits.Add([string]$model)
            }
        }
    }
    return @($hits)
}

# --- main --------------------------------------------------------------------
Write-Host ''
Write-Host "  Download-AnubisMesh.ps1  (PS $($PSVersionTable.PSVersion))" -ForegroundColor Cyan
Write-Host "  Destinazione: $OutFile"
Write-Host @'

  G-30: anubis_executioner.glb NON deve essere una copia di statue_anubis.glb.
  Fonte legale: Smithsonian Open Access (CC0) o ToxSam/Polygonal Mind (CC0).
  Poly Haven e HDRI, non personaggi.
  Pagina storica (404): 3d.si.edu/object/3d/anubis-statue:c8de4a6e-4ba3-11ea-b3bb-0eba7659d99b

'@ -ForegroundColor DarkYellow

New-Item -ItemType Directory -Force -Path $TmpDir, $EnemyDir | Out-Null

if ($LocalGlb) {
    Write-Step "Import locale $LocalGlb"
    if (-not (Test-Path -LiteralPath $LocalGlb)) {
        throw "LocalGlb non trovato: $LocalGlb"
    }
    $ok = Save-ToDestination -SourcePath $LocalGlb
    if (-not $ok) {
        throw "LocalGlb non valido o duplicato della statua: $LocalGlb"
    }
    Write-Host 'Fatto (file locale).' -ForegroundColor Green
    exit 0
}

$installed = $false

if (-not $SkipNetwork) {
    Write-Step 'Smithsonian 3D API (Open Access GLB)'
    $siUrls = @(Search-SmithsonianAnubis)
    $i = 0
    foreach ($u in $siUrls) {
        $i++
        $tmp = Join-Path $TmpDir "si-candidate-$i.glb"
        if (Try-DownloadUrl -Url $u -Dest $tmp) {
            if (Save-ToDestination -SourcePath $tmp) {
                $installed = $true
                break
            }
        }
    }

    if (-not $installed) {
        Write-Step 'ToxSam CC0 registry (GodAnubis / Anubis)'
        $urls = @(Search-ToxSamAnubis)
        foreach ($u in $urls) {
            $i++
            $tmp = Join-Path $TmpDir "candidate-$i.glb"
            if (Try-DownloadUrl -Url $u -Dest $tmp) {
                if (Save-ToDestination -SourcePath $tmp) {
                    $installed = $true
                    break
                }
            }
        }
    }
}

if (-not $SkipBrowser) {
    Write-Step 'Apro Smithsonian 3D (download manuale GLB/OBJ)'
    $pages = @(
        'https://3d.si.edu/explore?edan_q=Anubis',
        'https://3d.si.edu/explore/museum/freer-and-sackler-gallery',
        'https://3d.si.edu/collections/openaccesshighlights',
        'https://3d.si.edu',
        $SmithsonianObjectPage
    )
    foreach ($page in $pages) {
        try { Start-Process $page } catch { Write-Host "  browser: $($_.Exception.Message)" -ForegroundColor DarkGray }
        Start-Sleep -Milliseconds 400
    }
    Write-Host @'

  Sul sito 3d.si.edu:
    1. Explore -> cerca "Anubis" / "Egypt" / "jackal" (NON Papio anubis)
    2. Apri un oggetto con badge CC0 e "3D Download available"
    3. Scarica GLB (preferito) oppure OBJ
    4. Poi:
       pwsh -File scripts\Download-AnubisMesh.ps1 -LocalGlb "$env:USERPROFILE\Downloads\<file>.glb"

  Se scarichi OBJ, convertilo in GLB con Blender e poi usa -LocalGlb.

'@ -ForegroundColor Yellow
}

if (-not $installed) {
    Write-Step 'Nessun GLB distinto installato in automatico'
    Write-Host "Il Boia usa gia la mesh procedurale (EgyptianAnubisMesh) finche non importi un GLB." -ForegroundColor DarkGray
    Write-Host "Quando hai il file:" -ForegroundColor Yellow
    Write-Host "  pwsh -File scripts\Download-AnubisMesh.ps1 -LocalGlb `"<percorso>\anubis.glb`""
    exit 2
}

Write-Host ''
Write-Host 'Fatto.' -ForegroundColor Green
exit 0
