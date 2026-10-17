# Builds out\MightyVR-Host-Setup.exe (Windows, needs Node 22+ and Inno Setup 6). Used by .github/workflows/pc-host.yml.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$stage = Join-Path $root 'stage'
$version = if ($env:VERSION) { $env:VERSION -replace '^host-v', '' } else { '1.0.0' }
Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force "$stage\app" | Out-Null
Push-Location $root
npm ci --omit=dev
if ($LASTEXITCODE) { throw 'npm ci failed' }
Copy-Item src "$stage\app\src" -Recurse
Copy-Item package.json "$stage\app\"
Copy-Item node_modules "$stage\app\node_modules" -Recurse
Copy-Item (Get-Command node).Source "$stage\node.exe"
Copy-Item installer\launch.vbs, installer\stop.vbs $stage

# trim: other platforms' native binaries, docs, type files
$nm = "$stage\app\node_modules"
Get-ChildItem "$nm\koffi\build\koffi" -Directory -ErrorAction SilentlyContinue | Where-Object Name -ne 'win32_x64' | Remove-Item -Recurse -Force
Get-ChildItem "$nm\node-hid\prebuilds" -Directory -ErrorAction SilentlyContinue | Where-Object Name -ne 'HID-win32-x64' | Remove-Item -Recurse -Force
Get-ChildItem $nm -Recurse -Include *.md, *.map, *.d.ts -File -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

foreach ($f in 'node.exe', 'app\node_modules\ffmpeg-static\ffmpeg.exe', 'app\src\main.js') {
  if (-not (Test-Path "$stage\$f")) { throw "missing $f in the installer stage" }
}
$iscc = Join-Path ${env:ProgramFiles(x86)} 'Inno Setup 6\ISCC.exe'
if (-not (Test-Path $iscc)) { $iscc = (Get-Command iscc -ErrorAction Stop).Source }
& $iscc "/DVersion=$version" installer\mightyvr-host.iss
if ($LASTEXITCODE) { throw 'Inno Setup failed' }
Pop-Location
Write-Host "Built $root\out\MightyVR-Host-Setup.exe"
