# Chrome 웹 스토어 업로드용 zip을 dist/ 폴더에 생성한다.
# 사용법: 이 폴더에서 실행 -> powershell -File package.ps1
#
# System.IO.Compression.ZipFile을 직접 써서 슬래시(/) 구분자로 엔트리를 기록한다.
# (Compress-Archive는 Windows에서 백슬래시 경로를 그대로 저장해 zip 표준을 벗어난다)

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$root = $PSScriptRoot
$manifest = Get-Content (Join-Path $root "manifest.json") -Raw | ConvertFrom-Json
$version = $manifest.version

$distDir = Join-Path $root "dist"
if (-not (Test-Path $distDir)) {
  New-Item -ItemType Directory -Path $distDir | Out-Null
}

$zipPath = Join-Path $distDir "hate-speech-filter-extension-v$version.zip"
if (Test-Path $zipPath) {
  Remove-Item $zipPath -Force
}

$include = @(
  "manifest.json",
  "wordlists.js",
  "settings-utils.js",
  "content.js",
  "background.js",
  "popup.html",
  "popup.js",
  "popup.css",
  "styles.css",
  "icons",
  "wordpacks"
)

$zip = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)

function Add-FileEntry($zip, $filePath, $entryName) {
  $entryName = $entryName -replace '\\', '/'
  [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $filePath, $entryName) | Out-Null
}

foreach ($item in $include) {
  $src = Join-Path $root $item
  if (-not (Test-Path $src)) { continue }
  if ((Get-Item $src).PSIsContainer) {
    Get-ChildItem $src -Recurse -File | ForEach-Object {
      $relative = $_.FullName.Substring($root.Length + 1)
      Add-FileEntry $zip $_.FullName $relative
    }
  } else {
    Add-FileEntry $zip $src $item
  }
}

$zip.Dispose()

Write-Host "Created $zipPath"
