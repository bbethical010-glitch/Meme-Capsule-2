param(
  [string]$Owner     = "editorav010-dev",
  [string]$Repo      = "meme-capsule-sync",
  [string]$Branch    = "main",
  [string]$LocalPath,
  [string]$MetaPath,
  [string]$Message   = "Update MEME_CAPSULE_KNOWLEDGE.md via AI agent"
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

if (-not (Test-Path $MetaPath)) {
  Write-Error "Metadata file $MetaPath not found. Run fetch-knowledge.ps1 first."
  exit 1
}

$sha = (Get-Content $MetaPath -Encoding UTF8 | ConvertFrom-Json).sha

if (-not (Test-Path $LocalPath)) {
  Write-Error "Content file $LocalPath not found. Run fetch-knowledge.ps1 first."
  exit 1
}

$content = Get-Content $LocalPath -Raw -Encoding UTF8
if ([string]::IsNullOrWhiteSpace($content)) {
  Write-Error "Content file $LocalPath is empty. Aborting."
  exit 1
}

$b64 = [System.Convert]::ToBase64String(
  [System.Text.Encoding]::UTF8.GetBytes($content)
)

$headers = @{
  Authorization = "token $token"
  Accept        = "application/vnd.github.v3+json"
}

$body = @{
  message = $Message
  content = $b64
  sha     = $sha
  branch  = $Branch
} | ConvertTo-Json

$url = "https://api.github.com/repos/$Owner/$Repo/contents/MEME_CAPSULE_KNOWLEDGE.md"

try {
  $resp = Invoke-RestMethod -Uri $url -Headers $headers -Method Put `
          -Body $body -ContentType "application/json"
  $newSha = $resp.content.sha
  @{ sha = $newSha } | ConvertTo-Json | Set-Content -Path $MetaPath -Encoding UTF8

  if ($newSha -eq $sha) {
    Write-Warning "NOTICE: GitHub SHA did not change ($($newSha.Substring(0,7))). The content was identical to what is already on GitHub."
  } else {
    Write-Host "MEME_CAPSULE_KNOWLEDGE.md updated successfully! (new sha: $($newSha.Substring(0,7)))" -ForegroundColor Green
    Write-Host "Synced source: $LocalPath"
  }
} catch {
  $statusCode = 0
  $errorMsg = ""
  if ($_.Exception -and $_.Exception.Response) {
    $statusCode = [int]$_.Exception.Response.StatusCode
    try {
      $stream = $_.Exception.Response.GetResponseStream()
      $reader = New-Object System.IO.StreamReader($stream)
      $rawBody = $reader.ReadToEnd()
      $jsonBody = $rawBody | ConvertFrom-Json
      $errorMsg = $jsonBody.message
    } catch {}
  }

  if ($statusCode -eq 409) {
    Write-Warning "CONFLICT DETECTED (HTTP 409): Someone updated the file on GitHub after your last fetch."
    Write-Warning "1. Run .knowledge\fetch-knowledge.ps1 to get the latest version."
    Write-Warning "2. Merge your changes into the updated file."
    Write-Warning "3. Run .knowledge\update-knowledge.ps1 again."
  } elseif ($statusCode -eq 403) {
    Write-Error "PERMISSION DENIED (HTTP 403): GitHub returned: '$errorMsg'."
    Write-Error "Your CAPSULE_TOKEN (Personal Access Token) does not have write access to '$Owner/$Repo'."
  } elseif ($statusCode -eq 401) {
    Write-Error "AUTHENTICATION FAILED (HTTP 401): The CAPSULE_TOKEN is invalid or expired."
  } else {
    Write-Error "UPDATE FAILED: HTTP $statusCode - $($_.Exception.Message)"
    if ($errorMsg) { Write-Error "GitHub Message: $errorMsg" }
  }
  exit 1
}
