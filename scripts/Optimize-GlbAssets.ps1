<#
.SYNOPSIS
  Ottimizzazione batch GLB con gltf-transform (Draco + KTX2).
.EXAMPLE
  .\scripts\Optimize-GlbAssets.ps1 -RawDir .\public\assets\enemies\raw -OutDir .\public\assets\enemies
#>
param(
    [string]$RawDir = ".\public\assets\enemies\raw",
    [string]$OutDir = ".\public\assets\enemies",
    [int]   $TexSize = 1024,
    [double]$Simplify = 0.85
)

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$results = @()

Get-ChildItem -Path $RawDir -Filter "*.glb" -ErrorAction SilentlyContinue | ForEach-Object {
    $src  = $_.FullName
    $dest = Join-Path $OutDir $_.Name
    $before = [math]::Round($_.Length / 1KB, 1)

    Write-Host "Optimizing: $($_.Name) ($before KB)..." -ForegroundColor Yellow

    npx gltf-transform optimize $src $dest `
        --compress draco `
        --texture-compress ktx2 `
        --texture-resize $TexSize `
        --simplify $Simplify 2>&1 | Out-Null

    if (Test-Path $dest) {
        $after = [math]::Round((Get-Item $dest).Length / 1KB, 1)
        $saved = if ($before -gt 0) { [math]::Round(100 - ($after / $before * 100), 1) } else { 0 }
        $results += [PSCustomObject]@{ File=$_.Name; Before="${before}KB"; After="${after}KB"; Saved="${saved}%" }
        Write-Host "  -> ${after}KB (-${saved}%)" -ForegroundColor Green
    } else {
        Write-Host "  -> FAILED" -ForegroundColor Red
    }
}

$results | Format-Table -AutoSize
Write-Host "Optimization complete." -ForegroundColor Green
