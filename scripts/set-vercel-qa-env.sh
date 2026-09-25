#!/usr/bin/env bash
# Set gemini QA self-improve automation env on Vercel production and remove the
# retired two-automation (analyze/implement) vars. Production only: a preview
# deploy must never start a run that edits and pushes main.
#
# Usage:
#   WEBHOOK_TOKEN=crsr_... ./scripts/set-vercel-qa-env.sh
#   WEBHOOK_URL=... WEBHOOK_TOKEN=... ./scripts/set-vercel-qa-env.sh

set -uo pipefail

WEBHOOK_URL="${WEBHOOK_URL:-https://api2.cursor.sh/automations/webhook/03c21147-b824-11f1-977f-f6b8f2fcf9b2}"
WEBHOOK_TOKEN="${WEBHOOK_TOKEN:-}"
TRIGGERS="${TRIGGERS:-human_assign,bot_failure}"

if [[ -z "$WEBHOOK_TOKEN" ]]; then
  echo "Missing WEBHOOK_TOKEN — cursor.com/automations → this automation → Generate auth header"
  exit 1
fi

set_env() {
  if npx vercel env add "$1" production --value "$2" --force --yes </dev/null >/dev/null 2>&1; then
    echo "set $1"
  else
    echo "FAILED $1"
    exit 1
  fi
}

remove_env() {
  npx vercel env rm "$1" --yes </dev/null >/dev/null 2>&1 && echo "removed $1" || echo "absent $1"
}

set_env CURSOR_AUTOMATION_QA_ENABLED 1
set_env CURSOR_AUTOMATION_QA_TRIGGERS "$TRIGGERS"
set_env CURSOR_AUTOMATION_QA_WEBHOOK_URL "$WEBHOOK_URL"
set_env CURSOR_AUTOMATION_QA_WEBHOOK_TOKEN "$WEBHOOK_TOKEN"

remove_env CURSOR_AUTOMATION_WEBHOOK_URL
remove_env CURSOR_AUTOMATION_QA_ANALYZE_URL
remove_env CURSOR_AUTOMATION_QA_ANALYZE_TOKEN
remove_env CURSOR_AUTOMATION_QA_IMPLEMENT_URL
remove_env CURSOR_AUTOMATION_QA_IMPLEMENT_TOKEN

echo ""
echo "Done. Redeploy production, then:"
echo "  npx tsx scripts/e2e-verify-qa-automations.ts"
