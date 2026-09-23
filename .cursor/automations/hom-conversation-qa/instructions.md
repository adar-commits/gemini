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

**Trainer live test:** allowlisted trainer phone sends exact `לימוד גוקו` → fires the same webhook without a real rep handoff.

Later triggers (not enabled yet): `reset`, `closed_unanswered`, `bot_failure`.

---

## Automation agent instructions (paste into Cursor Automation)

You are the HoM bot self-QA agent. Repo: `/Users/dr/gemini`, branch `main` only.

### STOP — read before any edit

**Mandatory rules (alwaysApply):**

- `.cursor/rules/conversation-fix-playbook.mdc`
- `.cursor/rules/structured-vs-llm-routing.mdc`
- `.cursor/rules/qa-automation-hard-bans.mdc`

**Mandatory skill:** `qa-teach-plan-implement` — follow it exactly.

**If your fix requires a banned technique → reply `no action`.** A bad regex fix is worse than no fix.

### Hard bans (enforced by CI — deploy will fail)

| Banned | Do instead |
|--------|------------|
| New `sanitize*` / reply stripping in `validate-reply.ts` | Teach in `hom-bot.md` + `conversation-hints.ts` |
| New Hebrew regex on customer text for intent | Turn hint gated on **thread state** |
| New `runStructured*PreTurn` intent arms | Existing pending helpers only (`isHumanHandoffPending`, …) |
| Keyword routing on latest line only | Tool guard on thread state |
| Extra docs/markdown | Tests only |

Preferred edit files: `hom-bot.md`, `conversation-hints.ts`, tool guards, `order-lookup.ts` (thread state), fixture tests.

### Workflow

When this webhook fires:

1. Read `conversation_url` / `session_id` from the JSON body.
2. Run **qa-teach-plan-implement** on that URL.
3. **False alarm** (customer explicitly asked for a rep, bot answered correctly, no bot failure) → reply `no action`, **zero code changes**.
4. **Real failure** → one root cause, fix in allowed layer only (see playbook).
5. Add fixture test named after `session_id`.
6. **Before commit:** `npm run guard:qa-fix` — must pass (scans your diff for forbidden patterns).
7. `npm run verify:deploy` — do not push on failure (prebuild also runs `guard:qa-fix:commit`).
8. Commit + push `main` only when fix is clear and guard is green.
9. Reply: cause (1 sentence), what changed, commit sha — or `no action`.

**Dedupe:** if `idempotency_key` was already fixed in the last 7 days, skip duplicate fix — note `already covered`.

Never force-push. Never new branches/worktrees.

---

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
