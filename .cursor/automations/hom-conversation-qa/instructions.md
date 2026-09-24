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

**Root cause of `github-adar/adar-commits/gemini` 400:** Cursor stores the SSH host from automation creation. If the automation was created from the **Cursor IDE** while the local clone used `git@github-adar:...` or `core.sshCommand` with the adar key, Cursor canonicalizes to `github-adar` forever — re-saving settings does not fix it.

### Local clone (this Mac)

```bash
git remote set-url origin https://github.com/adar-commits/gemini.git
git config --unset core.sshCommand   # if set — Cursor maps adar key → github-adar host
```

- **Do not** use `git@github-adar:...` as remote (Cursor treats it as GitHub Enterprise).
- **Do not** set `core.sshCommand` on repos bound to Cursor automations/cloud agents.
- First HTTPS push: enter an **adar-commits** PAT when prompted (stored in macOS Keychain).

### Create automations (browser only — not IDE)

1. Open **https://cursor.com/automations** in Safari/Chrome — **not** Cursor’s Automations panel.
2. **Delete** both existing HoM QA automations (they have stale `github-adar` metadata).
3. **New automation** → Repository: pick **`adar-commits/gemini`** from the GitHub PAT dropdown.
4. Branch: **`main`**
5. Paste instructions from `instructions-analyze.md` / `instructions-implement.md` (`Repo: adar-commits/gemini` — never `/Users/dr/gemini`).
6. **Quit Cursor completely** (Cmd+Q), reopen, then test webhook — must **not** mention `github-adar`.

### Verify before enabling in Vercel

```bash
curl -s -X POST "$ANALYZE_URL" \
  -H "Authorization: Bearer $ANALYZE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"test":true,"session_id":"508272038","trigger":"human_assign","idempotency_key":"verify-'$(date +%s)'"}'
```

Expect HTTP **200** (or agent-start), **not** 400 with `github-adar`.

## Vercel env (gemini production)

**Analyze and Implement are two different Cursor automations** — copy each webhook URL from its own automation page. Using the Implement URL for both will 401 the Analyze token.

```
CURSOR_AUTOMATION_QA_ENABLED=1
CURSOR_AUTOMATION_QA_TRIGGERS=human_assign,bot_failure
CURSOR_AUTOMATION_QA_ANALYZE_URL=https://api2.cursor.sh/automations/webhook/03c21147-b824-11f1-977f-f6b8f2fcf9b2
CURSOR_AUTOMATION_QA_ANALYZE_TOKEN=crsr_...   # Generate auth header on **HoM QA Analyze** (Grok) automation
CURSOR_AUTOMATION_WEBHOOK_URL=https://api2.cursor.sh/automations/webhook/03c21147-b824-11f1-977f-f6b8f2fcf9b2
CURSOR_AUTOMATION_QA_IMPLEMENT_URL=https://api2.cursor.sh/automations/webhook/389581e6-b824-11f1-977f-f6b8f2fcf9b2
CURSOR_AUTOMATION_QA_IMPLEMENT_TOKEN=crsr_...   # Generate auth header on **Goku Training | Implementer (Composer)**
```

Current Implement automation (verified 2026-09-24): `Goku Training | Implementer (Composer)` → `389581e6-b824-11f1-977f-f6b8f2fcf9b2`.

Verify locally before/after Vercel edit:

```bash
npx tsx scripts/verify-qa-automation-env.ts
npx tsx scripts/e2e-verify-qa-automations.ts --session 532360395
```

## Analyze automation secrets (Grok chaining)

Grok chains implement through **gemini production** — only one secret needed in the Analyze automation:

```
CRON_SECRET=<same as Vercel production CRON_SECRET>
```

Verify Vercel has implement vars (already required for the proxy):

```bash
npx tsx scripts/verify-qa-automation-env.ts
curl -s https://gemini-xi-one-77.vercel.app/api/agents/qa-chain-implement
```

Do **not** duplicate `CURSOR_AUTOMATION_QA_IMPLEMENT_*` into Grok — that caused HTTP 401.

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
