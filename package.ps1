# 크롬용과 파이어폭스용 패키지를 dist/에 만든다.
# 사용법: 이 폴더에서 실행 -> powershell -File package.ps1
#
# 결과:
#   dist/hate-speech-filter-extension-vX.zip          크롬 웹 스토어 업로드용
#   firefox/                                          파이어폭스용 폴더. 저장소에 커밋되며
#                                                     about:debugging 임시 설치에서 이 안의 manifest.json을 선택
#   dist/hate-speech-filter-extension-firefox-vX.zip  addons.mozilla.org 제출/서명용
#
# firefox/ 는 이 스크립트가 매번 지우고 다시 만드는 생성물이다. 직접 고치지 말고
# 루트의 원본 파일을 고친 뒤 스크립트를 다시 실행한다.
#
# 크롬 매니페스트(manifest.json)는 크롬에 필요한 것만 두고, 파이어폭스용은 아래에서
# background 블록만 바꾸고 gecko 설정을 더해서 따로 만든다. 한 파일에 둘을 다 넣으면
# 크롬이 "'background.scripts' requires manifest version of 2 or lower" 경고를 띄운다.
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
  "styles.css",
  "icons",
  "wordpacks"
)

$firefoxBackground = @'
"browser_specific_settings": {
    "gecko": {
      "id": "hate-speech-filter@iamtalker.github.io",
      "strict_min_version": "121.0",
      "data_collection_permissions": { "required": ["none"] }
    }
  },
  "background": {
    "scripts": ["wordlists.js", "settings-utils.js", "background.js"]
  }
'@

function Copy-Sources($destDir) {
  New-Item -ItemType Directory -Path $destDir | Out-Null
  foreach ($item in $include) {
    $src = Join-Path $root $item
    if (Test-Path $src) { Copy-Item $src -Destination $destDir -Recurse }
  }
}

function New-ZipFromDir($srcDir, $zipPath) {
  $zip = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
  Get-ChildItem $srcDir -Recurse -File | ForEach-Object {
    $entry = $_.FullName.Substring($srcDir.Length + 1) -replace '\\', '/'
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $entry) | Out-Null
  }
  $zip.Dispose()
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# 크롬
$chromeDir = Join-Path $distDir "chrome"
Copy-Sources $chromeDir
$chromeZip = Join-Path $distDir "hate-speech-filter-extension-v$version.zip"
New-ZipFromDir $chromeDir $chromeZip

# 파이어폭스: background 블록을 scripts 방식으로 교체하고 gecko 설정을 추가
$pattern = '"background"\s*:\s*\{[^}]*\}'
if ($manifestText -notmatch $pattern) { throw "manifest.json에서 background 블록을 찾지 못했습니다." }
$firefoxManifest = [regex]::Replace($manifestText, $pattern, { param($m) $firefoxBackground })
$parsed = $firefoxManifest | ConvertFrom-Json
if ($parsed.background.service_worker -or -not $parsed.background.scripts -or -not $parsed.browser_specific_settings.gecko.id) {
  throw "파이어폭스용 매니페스트 생성 결과가 올바르지 않습니다."
}

$firefoxDir = Join-Path $root "firefox"
if (Test-Path $firefoxDir) { Remove-Item $firefoxDir -Recurse -Force }
Copy-Sources $firefoxDir
[System.IO.File]::WriteAllText((Join-Path $firefoxDir "manifest.json"), $firefoxManifest, $utf8NoBom)
$firefoxZip = Join-Path $distDir "hate-speech-filter-extension-firefox-v$version.zip"
New-ZipFromDir $firefoxDir $firefoxZip

Write-Host "Created $chromeZip"
Write-Host "Created $firefoxZip"
