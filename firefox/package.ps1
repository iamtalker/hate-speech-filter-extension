# AMO(addons.mozilla.org) 제출용 zip을 만든다.
# 사용법: powershell -File package.ps1
# 결과: dist/hate-speech-filter-firefox-vX.zip
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$root = $PSScriptRoot
$version = ([System.IO.File]::ReadAllText((Join-Path $root "manifest.json"), [System.Text.Encoding]::UTF8) | ConvertFrom-Json).version

$distDir = Join-Path $root "dist"
if (Test-Path $distDir) { Remove-Item $distDir -Recurse -Force }
New-Item -ItemType Directory -Path $distDir | Out-Null

$include = @("manifest.json","wordlists.js","settings-utils.js","content.js","background.js",
  "popup.html","popup.js","popup.css","options.html","options.js","options.css","styles.css","icons","wordpacks")

$buildDir = Join-Path $distDir "build"
New-Item -ItemType Directory -Path $buildDir | Out-Null
foreach ($item in $include) {
  $src = Join-Path $root $item
  if (Test-Path $src) { Copy-Item $src -Destination $buildDir -Recurse }
}

$zipPath = Join-Path $distDir "hate-speech-filter-firefox-v$version.zip"
$zip = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
Get-ChildItem $buildDir -Recurse -File | ForEach-Object {
  $entry = $_.FullName.Substring($buildDir.Length + 1) -replace '\\', '/'
  [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $entry) | Out-Null
}
$zip.Dispose()
Write-Host "Created $zipPath"
