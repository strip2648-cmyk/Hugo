#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20+ is required. Install Node.js and run ./setup.sh again." >&2
  exit 1
fi
NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if (( NODE_MAJOR < 20 )); then
  echo "Node.js 20+ is required; found $(node --version)." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required. Install npm and run ./setup.sh again." >&2
  exit 1
fi

echo "Installing Node.js dependencies..."
npm install

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example."
fi

set_env_default() {
  local key="$1"
  local value="$2"
  local current=""
  if grep -q "^${key}=" .env; then
    current="$(sed -n "s/^${key}=//p" .env | head -n 1)"
    current="${current#\"}"
    current="${current%\"}"
    current="${current#\'}"
    current="${current%\'}"
    if [[ -z "$current" || "$current" == "local-model" ]]; then
      sed -i "s|^${key}=.*|${key}=${value}|" .env
    fi
  else
    printf '%s=%s\n' "$key" "$value" >> .env
  fi
}

set_env_default HUGO_LOCAL_AI_ENDPOINT "http://127.0.0.1:11434"
set_env_default HUGO_LOCAL_AI_MODEL "qwen2.5:3b"

if ! command -v ollama >/dev/null 2>&1; then
  echo "Ollama is not installed. Install it from https://ollama.com, then run ./setup.sh again." >&2
  exit 1
fi

if ! curl -fsS --max-time 3 http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  echo "Ollama не работи. Стартувај 'ollama serve' во посебен терминал, па повторно изврши ./setup.sh." >&2
  exit 1
fi

MODEL="$(sed -n 's/^HUGO_LOCAL_AI_MODEL=//p' .env | head -n 1)"
MODEL="${MODEL#\"}"
MODEL="${MODEL%\"}"
MODEL="${MODEL#\'}"
MODEL="${MODEL%\'}"
if [[ -z "$MODEL" ]]; then
  echo "HUGO_LOCAL_AI_MODEL is empty in .env." >&2
  exit 1
fi

if ! ollama list | awk 'NR > 1 { print $1 }' | grep -Fxq "$MODEL"; then
  echo "Pulling Ollama model: $MODEL"
  ollama pull "$MODEL"
else
  echo "Ollama model already available: $MODEL"
fi

mkdir -p .hugo
if ! curl -fsS --max-time 2 http://127.0.0.1:9222/json/version >/dev/null 2>&1; then
  echo "Starting Chrome/Chromium through HUGO..."
  nohup npm run chrome > .hugo/chrome-setup.log 2>&1 &
else
  echo "Chrome CDP is already running on port 9222."
fi

echo "Starting HUGO..."
exec npm start
