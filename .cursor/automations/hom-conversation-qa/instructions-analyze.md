# HoM QA — Analyze automation (Grok 4.7 High)

**Model:** Grok 4.7 High · **Read-only** — do not edit bot code, do not commit, do not push.

Repo: `adar-commits/gemini` · branch `main` only.

## Bootstrap

1. Read `.cursor/rules/conversation-fix-playbook.mdc`, `structured-vs-llm-routing.mdc`, `qa-automation-hard-bans.mdc`.
2. Read `qa-teach-plan-implement` skill — **QA section only** (steps 1–2).

## When webhook POST arrives

Payload includes `conversation_url`, `session_id`, `trigger` (`human_assign` | `bot_failure`), optional `last_user_message` / `last_bot_reply`.

1. Read the **full** thread (`npx tsx scripts/read-hom-conversation.ts <session_id>` or Supabase `walklyxhkhrdzbkfhtez`).
2. Save the inbound POST body to `.cursor/qa-queue/<session_id>.source.json`.
3. Decide verdict — write `root_cause` and `fix_plan` in **easy Hebrew** (short sentences, no jargon). Dashboard labels are הבעיה / הפתרון.

### Verdicts

| Verdict | When |
|---------|------|
| `false_alarm` | Customer wanted a rep; bot behaved correctly |
| `already_covered` | Same bug class fixed in last 7 days (check `commit-log.jsonl` / `BRIEF.md`) |
| `too_risky` | Fix would touch routing policy, gender, semantics, or needs product call |
| `ask_operator` | Hebrew policy ambiguous — **stop and ask operator** (fill `operator_questions`) |
| `real_failure` | Clear bot mistake; fix layer obvious |

### Implement gate (strict)

Chain to Composer **only if ALL true**:

- `verdict`: `real_failure`
- `confidence`: `high` (not medium/low)
- `fix_layer`: one of `prompt` | `hints` | `tool_guard` | `pre_turn` | `runtime`
- `fix_plan`: 1–3 bullets — **no regex/sanitizer plans**
- Fix is **required** — not a nice-to-have tweak

If unsure → `ask_operator` with 1–3 multiple-choice questions. **Do not guess.**

4. Write `.cursor/qa-queue/<session_id>.analysis.json` matching `analysis-schema.json`.

Example:

```json
{
  "session_id": "532452401",
  "conversation_url": "https://service.hom-group.co.il/conversations/532452401",
  "trigger": "bot_failure",
  "verdict": "real_failure",
  "confidence": "high",
  "root_cause": "הבוט שלח 'לא הצלחתי להבין' למרות שמספר ההזמנה מהקבלה כבר היה בשיחה.",
  "fix_layer": "hints",
  "fix_plan": [
    "להוסיף hint לפי מצב השיחה כשיש orderID מהקבלה והלקוח אישר כן"
  ],
  "analyzed_at": "2026-09-24T07:00:00.000Z"
}
```

5. Log to dashboard (required):

```bash
npx tsx scripts/log-qa-run.ts --phase analyze --session <session_id> --trigger <trigger> \
  --outcome <false_alarm|ask_operator|too_risky|already_covered|chained|no_action> \
  --verdict <verdict> --confidence <high|medium|low> --risk <1-10> \
  --cause "<easy Hebrew root cause — same text as root_cause>" \
  --idempotency-key "<from webhook payload>"
```

Use `--outcome chained` only when chaining to implement. Include `--fix-layer` and `--fix-plan "bullet one|bullet two"` when chaining.

6. Reply in chat: verdict + one-sentence cause + risk score.

7. If approved for implement — chain via **gemini production** (implement tokens live on Vercel only):

```bash
curl -s -X POST "https://gemini-xi-one-77.vercel.app/api/agents/qa-chain-implement" \
  -H "Authorization: <paste exact inbound webhook Authorization header from this run>" \
  -H "Content-Type: application/json" \
  -d @- <<EOF
{
  "analysis": $(cat .cursor/qa-queue/<session_id>.analysis.json),
  "source": $(cat .cursor/qa-queue/<session_id>.source.json)
}
EOF
```

Use the **same Bearer token** Vercel sent on the inbound POST (this automation's webhook auth header in Cursor → Automations). No separate Secrets field needed — the proxy accepts that token or Vercel `CRON_SECRET`.

Fallback (local with `.env.production.local`):

```bash
npx tsx scripts/chain-qa-implement-webhook.ts .cursor/qa-queue/<session_id>.analysis.json --source-payload .cursor/qa-queue/<session_id>.source.json
```

Otherwise stop — **no code edits on analyze.**

## Banned on analyze

- No edits to `hom-bot.md`, hints, tools, tests
- No “while I'm here” refactors
- No gender / semantics / tone rewrites in fix plans
