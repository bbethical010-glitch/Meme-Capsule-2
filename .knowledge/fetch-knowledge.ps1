param(
  [string]$Owner     = "editorav010-dev",
  [string]$Repo      = "meme-capsule-sync",
  [string]$Branch    = "main",
  [string]$LocalPath,
  [string]$MetaPath
)

# Resolve paths dynamically relative to script directory and project root
$ScriptDir = $PSScriptRoot
$ProjectRoot = Split-Path -Parent $ScriptDir

if (-not $MetaPath) {
  $MetaPath = Join-Path $ScriptDir ".knowledge_meta.json"
}

if (-not $LocalPath) {
  if (Test-Path (Join-Path $ProjectRoot "docs\MEME_CAPSULE_KNOWLEDGE.md")) {
    $LocalPath = Join-Path $ProjectRoot "docs\MEME_CAPSULE_KNOWLEDGE.md"
  } elseif (Test-Path (Join-Path $ScriptDir "MEME_CAPSULE_KNOWLEDGE.md")) {
    $LocalPath = Join-Path $ScriptDir "MEME_CAPSULE_KNOWLEDGE.md"
  } elseif (Test-Path (Join-Path $ProjectRoot "MEME_CAPSULE_KNOWLEDGE.md")) {
    $LocalPath = Join-Path $ProjectRoot "MEME_CAPSULE_KNOWLEDGE.md"
  } else {
    $LocalPath = Join-Path $ProjectRoot "docs\MEME_CAPSULE_KNOWLEDGE.md"
  }
}

$token = $env:CAPSULE_TOKEN
if (-not $token) {
  $token = [System.Environment]::GetEnvironmentVariable('CAPSULE_TOKEN', 'User')
  if (-not $token) {
    $token = [System.Environment]::GetEnvironmentVariable('CAPSULE_TOKEN', 'Machine')
  }
}
if (-not $token) {
  # Check if a .env file exists in .knowledge or project root
  $envFiles = @(
    (Join-Path $ScriptDir ".env"),
    (Join-Path $ProjectRoot ".env")
  )
  foreach ($ef in $envFiles) {
    if (Test-Path $ef) {
      Get-Content $ef | ForEach-Object {
        if ($_ -match "^\s*CAPSULE_TOKEN\s*=\s*(.+?)\s*$") {
          $token = $matches[1].Trim('"').Trim("'")
        }
      }
      if ($token) { break }
    }
  }
}

if (-not $token) {
  Write-Error "CAPSULE_TOKEN not set. Set CAPSULE_TOKEN environment variable or add it to .knowledge/.env first."
  exit 1
}

$headers = @{
  Authorization = "token $token"
  Accept        = "application/vnd.github.v3+json"
}

$url = "https://api.github.com/repos/$Owner/$Repo/contents/MEME_CAPSULE_KNOWLEDGE.md?ref=$Branch"

try {
  $resp = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
} catch {
  Write-Error "Failed to fetch from GitHub: $_"
  exit 1
}

$content = [System.Text.Encoding]::UTF8.GetString(
  [System.Convert]::FromBase64String($resp.content)
)

$targetDir = Split-Path -Parent $LocalPath
if (-not (Test-Path $targetDir)) {
  New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
}

$metaDir = Split-Path -Parent $MetaPath
if (-not (Test-Path $metaDir)) {
  New-Item -ItemType Directory -Force -Path $metaDir | Out-Null
}

Set-Content -Path $LocalPath -Value $content -NoNewline -Encoding UTF8
@{ sha = $resp.sha } | ConvertTo-Json | Set-Content -Path $MetaPath -Encoding UTF8

Write-Host "MEME_CAPSULE_KNOWLEDGE.md fetched successfully! (sha: $($resp.sha.Substring(0,7))) -> synced to $LocalPath" -ForegroundColor Green
