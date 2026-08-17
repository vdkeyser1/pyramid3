$WshShell = New-Object -ComObject WScript.Shell
$desktopPath = [Environment]::GetFolderPath('Desktop')
$projectRoot = $PSScriptRoot
$shortcutPath = Join-Path $desktopPath 'La Piramide Perduta.lnk'
$targetPath = Join-Path $projectRoot 'start-game.bat'
$Shortcut = $WshShell.CreateShortcut($shortcutPath)
$Shortcut.TargetPath = $targetPath
$Shortcut.WorkingDirectory = $projectRoot
$Shortcut.Description = "Avvia La Piramide Perduta - Egyptian Noir Roguelike FPS"
$Shortcut.IconLocation = "C:\Windows\System32\SHELL32.dll,174"
$Shortcut.Save()
Write-Output "Shortcut creata"
