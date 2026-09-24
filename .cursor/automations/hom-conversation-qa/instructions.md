# HoM conversation self-QA (two automations)

Production **gemini** POSTs to **Analyze** only. Analyze (Grok) may chain to **Implement** (Composer).

```
gemini handoff / never-stuck
  → POST analyze webhook
  → Grok: read thread, write analysis JSON
  → if high-confidence real_failure → POST implement webhook
  → Composer: fix + test + commit + log BRIEF.md
```

## Setup (Cursor Automations)

| Automation | Model | Paste instructions from |
|------------|-------|-------------------------|
| **HoM QA Analyze** | Grok 4.7 High | `instructions-analyze.md` |
| **HoM QA Implement** | Composer 2.5 | `instructions-implement.md` |

## Repo binding (Cursor automations)

- Repository: **`adar-commits/gemini`** from the GitHub dropdown (PAT) — **not** a local folder path.
- Branch: **`main`**
- Instructions say `Repo: adar-commits/gemini` — never `/Users/dr/gemini`.
- Local clone remote must be `git@github.com:adar-commits/gemini.git` (not `github-adar` SSH alias).
- If webhooks return `github-adar/adar-commits/gemini`, **delete and recreate** both automations after fixing remote.

## Vercel env (gemini production)

```
CURSOR_AUTOMATION_QA_ENABLED=1
CURSOR_AUTOMATION_QA_TRIGGERS=human_assign,bot_failure
CURSOR_AUTOMATION_QA_ANALYZE_URL=https://api2.cursor.sh/automations/webhook/e4f4b7a1-b820-11f1-977f-f6b8f2fcf9b2
CURSOR_AUTOMATION_QA_ANALYZE_TOKEN=crsr_...   # Generate auth header on Analyze automation
CURSOR_AUTOMATION_WEBHOOK_URL=https://api2.cursor.sh/automations/webhook/e4f4b7a1-b820-11f1-977f-f6b8f2fcf9b2
CURSOR_AUTOMATION_QA_IMPLEMENT_URL=https://api2.cursor.sh/automations/webhook/10bd1ba9-b821-11f1-977f-f6b8f2fcf9b2
CURSOR_AUTOMATION_QA_IMPLEMENT_TOKEN=crsr_...   # Generate auth header on Implement automation
```

## Analyze automation secrets (Grok chaining)

```
CURSOR_AUTOMATION_QA_IMPLEMENT_URL=https://api2.cursor.sh/automations/webhook/10bd1ba9-b821-11f1-977f-f6b8f2fcf9b2
CURSOR_AUTOMATION_QA_IMPLEMENT_TOKEN=crsr_...   # Same as Vercel implement token
```

## Triggers

| Trigger | When |
|---------|------|
| `human_assign` | Rep handoff (`human_service` / `human_sales`) |
| `bot_failure` | Never-stuck: "לא הצלחתי להבין את ההודעה…" |

Trainer `לימוד גוקו` → same analyze webhook (test).

## Source webhook payload

```json
{
  "conversation_url": "https://service.hom-group.co.il/conversations/{session_id}",
  "session_id": "508272038",
  "landbot_customer_id": "508054404",
  "trigger": "human_assign",
  "handoff_action": "human_service",
  "last_user_message": "...",
  "last_bot_reply": "...",
  "idempotency_key": "508272038:human_assign",
  "phone_last4": "8636",
  "sent_at": "2026-09-23T..."
}
```

Implement webhook adds `"phase": "implement"` and `"analysis": { ... }` — see `analysis-schema.json`.

## Operator briefing & revert

- **Brief:** `.cursor/automations/hom-conversation-qa/BRIEF.md` (plain language, updated each implement push)
- **Full log:** `commit-log.jsonl`
- **Revert:** `npm run qa:vanish -- <commit-sha>` or tell any agent: **vanish commit `<sha>`**

## Shared rules (both automations)

- `.cursor/rules/conversation-fix-playbook.mdc`
- `.cursor/rules/structured-vs-llm-routing.mdc`
- `.cursor/rules/qa-automation-hard-bans.mdc`
- `qa-teach-plan-implement` skill
- CI: `qa-fix-guard` on every implement commit

**If unsure whether to fix → `ask_operator` on analyze — never guess on implement.**
