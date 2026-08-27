<#
.SYNOPSIS
  Conversione FBX → GLB via Blender CLI (GAME-ART-002 / Mixamo).
.EXAMPLE
  .\scripts\Convert-FbxToGlb.ps1 -InputDir .\assets\fbx -OutputDir .\public\assets\enemies\raw
#>
param(
    [string]$InputDir  = ".\assets\fbx",
    [string]$OutputDir = ".\public\assets\enemies\raw",
    [string]$BlenderExe = "C:\Program Files\Blender Foundation\Blender 4.2\blender.exe"
)

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$blendPy = @"
import bpy, sys, os
argv = sys.argv[sys.argv.index('--') + 1:]
inp, out = argv[0], argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(
    filepath=inp,
    use_anim=True,
    automatic_bone_orientation=True,
    primary_bone_axis='Y'
)
bpy.ops.export_scene.gltf(
    filepath=out,
    export_format='GLB',
    export_animations=True,
    export_skins=True,
    export_apply=False,
    export_morph=True
)
print(f'[OK] {out}')
"@

$tmpPy = [IO.Path]::GetTempFileName() -replace '\.tmp$','.py'
$blendPy | Set-Content $tmpPy -Encoding UTF8

if (-not (Test-Path $BlenderExe)) {
    Write-Host "Blender non trovato: $BlenderExe" -ForegroundColor Yellow
    Write-Host "Installa Blender 4.2 o passa -BlenderExe." -ForegroundColor Yellow
    Remove-Item $tmpPy -Force
    exit 1
}

Get-ChildItem -Path $InputDir -Filter "*.fbx" -ErrorAction SilentlyContinue | ForEach-Object {
    $out = Join-Path $OutputDir ($_.BaseName + ".glb")
    Write-Host "Converting $($_.Name)..." -ForegroundColor Cyan
    & $BlenderExe --background --python $tmpPy -- $_.FullName $out 2>&1 | Where-Object { $_ -match '\[OK\]|Error' }
}

Remove-Item $tmpPy -Force
Write-Host "Done." -ForegroundColor Green
