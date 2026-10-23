#!/usr/bin/env bash
# ==============================================================================
# fetch-knowledge.sh — Cross-codebase Knowledge Fetcher for macOS & Linux
# Fetches MEME_CAPSULE_KNOWLEDGE.md from editorav010-dev/meme-capsule-sync
# ==============================================================================

set -euo pipefail

OWNER="editorav010-dev"
REPO="meme-capsule-sync"
BRANCH="main"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

META_PATH="${META_PATH:-$SCRIPT_DIR/.knowledge_meta.json}"

if [ -z "${LOCAL_PATH:-}" ]; then
  if [ -f "$PROJECT_ROOT/docs/MEME_CAPSULE_KNOWLEDGE.md" ]; then
    LOCAL_PATH="$PROJECT_ROOT/docs/MEME_CAPSULE_KNOWLEDGE.md"
  elif [ -f "$SCRIPT_DIR/MEME_CAPSULE_KNOWLEDGE.md" ]; then
    LOCAL_PATH="$SCRIPT_DIR/MEME_CAPSULE_KNOWLEDGE.md"
  elif [ -f "$PROJECT_ROOT/MEME_CAPSULE_KNOWLEDGE.md" ]; then
    LOCAL_PATH="$PROJECT_ROOT/MEME_CAPSULE_KNOWLEDGE.md"
  else
    LOCAL_PATH="$PROJECT_ROOT/docs/MEME_CAPSULE_KNOWLEDGE.md"
  fi
fi

# 1. Resolve CAPSULE_TOKEN
TOKEN="${CAPSULE_TOKEN:-}"

if [ -z "$TOKEN" ]; then
  for env_file in "$SCRIPT_DIR/.env" "$PROJECT_ROOT/.env"; do
    if [ -f "$env_file" ]; then
      set +e
      TOKEN_LINE=$(grep -E '^\s*CAPSULE_TOKEN\s*=' "$env_file" | head -n 1)
      set -e
      if [ -n "$TOKEN_LINE" ]; then
        TOKEN=$(echo "$TOKEN_LINE" | sed -E 's/^\s*CAPSULE_TOKEN\s*=\s*//' | tr -d '"'\'' ')
        break
      fi
    fi
  done
fi

if [ -z "$TOKEN" ]; then
  echo "Error: CAPSULE_TOKEN is not set." >&2
  echo "Set it via: export CAPSULE_TOKEN=\"ghp_...\" or create a .knowledge/.env file." >&2
  exit 1
fi

API_URL="https://api.github.com/repos/$OWNER/$REPO/contents/MEME_CAPSULE_KNOWLEDGE.md?ref=$BRANCH"

# 2. Fetch from GitHub API
RESP=$(curl -s -f -H "Authorization: token $TOKEN" -H "Accept: application/vnd.github.v3+json" "$API_URL" || true)

if [ -z "$RESP" ]; then
  echo "Error: Failed to fetch from GitHub API. Verify your network and CAPSULE_TOKEN permissions." >&2
  exit 1
fi

# 3. Decode base64 content and write metadata
mkdir -p "$(dirname "$LOCAL_PATH")"
mkdir -p "$(dirname "$META_PATH")"

if command -v python3 >/dev/null 2>&1; then
  python3 -c '
import sys, json, base64

resp_str = sys.stdin.read()
data = json.loads(resp_str)
raw_b64 = data.get("content", "")
content = base64.b64decode(raw_b64).decode("utf-8")

with open("'"$LOCAL_PATH"'", "w", encoding="utf-8") as f:
    f.write(content)

with open("'"$META_PATH"'", "w", encoding="utf-8") as f:
    json.dump({"sha": data["sha"]}, f, indent=2)

print(f"MEME_CAPSULE_KNOWLEDGE.md fetched successfully! (sha: {data['sha'][:7]}) -> synced to '"$LOCAL_PATH"'")
' <<< "$RESP"
elif command -v node >/dev/null 2>&1; then
  node -e '
const fs = require("fs");
const data = JSON.parse(process.argv[1]);
const content = Buffer.from(data.content, "base64").toString("utf-8");
fs.writeFileSync(process.argv[2], content, "utf-8");
fs.writeFileSync(process.argv[3], JSON.stringify({ sha: data.sha }, null, 2), "utf-8");
console.log(`MEME_CAPSULE_KNOWLEDGE.md fetched successfully! (sha: ${data.sha.slice(0, 7)}) -> synced to ${process.argv[2]}`);
' "$RESP" "$LOCAL_PATH" "$META_PATH"
else
  # Fallback for environments without python3 or node
  SHA=$(echo "$RESP" | grep -o '"sha": *"[^"]*"' | head -n 1 | cut -d'"' -f4)
  B64_CONTENT=$(echo "$RESP" | grep -o '"content": *"[^"]*"' | head -n 1 | cut -d'"' -f4)
  
  if echo "dGVzdA==" | base64 -D >/dev/null 2>&1; then
    # macOS BSD base64
    echo "$B64_CONTENT" | base64 -D > "$LOCAL_PATH"
  else
    # Linux GNU base64
    echo "$B64_CONTENT" | base64 -d > "$LOCAL_PATH"
  fi
  echo "{\"sha\": \"$SHA\"}" > "$META_PATH"
  echo "MEME_CAPSULE_KNOWLEDGE.md fetched successfully! (sha: ${SHA:0:7}) -> synced to $LOCAL_PATH"
fi
