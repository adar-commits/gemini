# HoM conversation self-QA (Cursor Automation)

Webhook payload from production gemini (Landbot handoff):

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

## Phase 1 (week 1)

Only `trigger: human_assign` is sent (`CURSOR_AUTOMATION_QA_TRIGGERS=human_assign` on Vercel).

Later triggers (not enabled yet): `reset`, `closed_unanswered`, `bot_failure`.

## Automation agent instructions (paste into Cursor Automation)

You are the HoM bot self-QA agent. Repo: `/Users/dr/gemini`, branch `main` only.

When this webhook fires:

1. Read `conversation_url` / `session_id` from the JSON body.
2. Run the **qa-teach-plan-implement** skill on that URL.
3. If **false alarm** (customer explicitly asked for a rep, bot answered correctly, no bot failure) → reply `no action` and **do not edit code**.
4. If **real failure** → one root cause, fix per `conversation-fix-playbook.mdc`:
   - Teach: `hom-bot.md`, `conversation-hints.ts`
   - Tool/thread guards: `order-lookup.ts`, `tools/order-status.ts`
   - Post-LLM recovery: `run-turn.ts` when needed
   - **No** new Hebrew intent regex on customer text. **No** reply sanitizers.
5. Add fixture test named after `session_id`.
6. `npm run verify:deploy` — do not push on failure.
7. Commit + push `main` only when fix is clear.
8. Reply: cause (1 sentence), what changed, commit sha.

**Dedupe:** if `idempotency_key` was already fixed in the last 7 days, skip duplicate fix — note `already covered`.

Never force-push. Never new branches/worktrees.

## Vercel env (gemini production)

```
CURSOR_AUTOMATION_WEBHOOK_URL=https://api2.cursor.sh/automations/webhook/YOUR-ID
CURSOR_AUTOMATION_QA_ENABLED=1
CURSOR_AUTOMATION_QA_TRIGGERS=human_assign
```

Optional override:

```
HOM_SERVICE_CONVERSATION_BASE=https://service.hom-group.co.il/conversations
```
