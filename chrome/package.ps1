# 크롬 웹 스토어 업로드용 zip을 만든다.
# 사용법: 이 폴더에서 실행
#   powershell -File package.ps1
#
# 결과: dist/hate-speech-filter-extension-vX.zip
#
# zip은 System.IO.Compression으로 직접 만들어 슬래시(/) 구분자로 기록한다.
# (Compress-Archive는 Windows에서 백슬래시 경로를 저장해 zip 표준을 벗어난다)

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$root = $PSScriptRoot
$manifestText = [System.IO.File]::ReadAllText((Join-Path $root "manifest.json"), [System.Text.Encoding]::UTF8)
$version = ($manifestText | ConvertFrom-Json).version

$distDir = Join-Path $root "dist"
if (Test-Path $distDir) { Remove-Item $distDir -Recurse -Force }
New-Item -ItemType Directory -Path $distDir | Out-Null

$include = @(
  "manifest.json",
  "wordlists.js",
  "settings-utils.js",
  "content.js",
  "background.js",
  "popup.html",
  "popup.js",
  "popup.css",
  "options.html",
  "options.js",
  "options.css",
  "styles.css",
  "icons",
  "wordpacks"
)

$buildDir = Join-Path $distDir "chrome"
New-Item -ItemType Directory -Path $buildDir | Out-Null
foreach ($item in $include) {
  $src = Join-Path $root $item
  if (Test-Path $src) { Copy-Item $src -Destination $buildDir -Recurse }
}

$zipPath = Join-Path $distDir "hate-speech-filter-extension-v$version.zip"
$zip = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
Get-ChildItem $buildDir -Recurse -File | ForEach-Object {
  $entry = $_.FullName.Substring($buildDir.Length + 1) -replace '\\', '/'
  [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $entry) | Out-Null
}
$zip.Dispose()

Write-Host "Created $zipPath"
