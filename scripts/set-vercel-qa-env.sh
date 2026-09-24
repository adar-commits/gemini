#!/usr/bin/env bash
# Set gemini production QA automation env on Vercel.
# Requires: VERCEL_TOKEN, project linked or VERCEL_ORG_ID + VERCEL_PROJECT_ID
#
# Usage:
#   export VERCEL_TOKEN=...
#   ./scripts/set-vercel-qa-env.sh
#
# Override defaults:
#   ANALYZE_URL=... IMPLEMENT_URL=... ANALYZE_TOKEN=... IMPLEMENT_TOKEN=... ./scripts/set-vercel-qa-env.sh

set -euo pipefail

IMPLEMENT_URL="${IMPLEMENT_URL:-https://api2.cursor.sh/automations/webhook/389581e6-b824-11f1-977f-f6b8f2fcf9b2}"
IMPLEMENT_TOKEN="${IMPLEMENT_TOKEN:-}"
ANALYZE_URL="${ANALYZE_URL:-}"
ANALYZE_TOKEN="${ANALYZE_TOKEN:-}"

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "Missing VERCEL_TOKEN — create at https://vercel.com/account/tokens"
  exit 1
fi

if [[ -z "$IMPLEMENT_TOKEN" ]]; then
  echo "Missing IMPLEMENT_TOKEN — Generate auth header on Goku Training | Implementer (Composer)"
  exit 1
fi

if [[ -z "$ANALYZE_URL" || -z "$ANALYZE_TOKEN" ]]; then
  echo "Missing ANALYZE_URL / ANALYZE_TOKEN."
  echo "These must come from the **Grok Analyze** automation (NOT the Implementer URL)."
  echo "Open cursor.com/automations → HoM QA Analyze → copy webhook URL + Generate auth header."
  exit 1
fi

add_env() {
  local key="$1"
  local value="$2"
  printf '%s' "$value" | npx vercel env add "$key" production --force --yes
  echo "set $key"
}

add_env CURSOR_AUTOMATION_QA_ENABLED 1
add_env CURSOR_AUTOMATION_QA_TRIGGERS "human_assign,bot_failure"
add_env CURSOR_AUTOMATION_QA_ANALYZE_URL "$ANALYZE_URL"
add_env CURSOR_AUTOMATION_QA_ANALYZE_TOKEN "$ANALYZE_TOKEN"
add_env CURSOR_AUTOMATION_WEBHOOK_URL "$ANALYZE_URL"
add_env CURSOR_AUTOMATION_QA_IMPLEMENT_URL "$IMPLEMENT_URL"
add_env CURSOR_AUTOMATION_QA_IMPLEMENT_TOKEN "$IMPLEMENT_TOKEN"

echo ""
echo "Done. Redeploy production, then:"
echo "  curl -s https://gemini-xi-one-77.vercel.app/api/agents/qa-chain-implement"
echo "  npx tsx scripts/e2e-verify-qa-automations.ts --session 532360395"
