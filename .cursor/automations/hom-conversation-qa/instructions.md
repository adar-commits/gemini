# HoM self-improve automation (single run)

One Cursor automation does **QA → Analyze → Brief → Develop**.

```
gemini handoff (human_assign) / never-stuck (bot_failure) / dashboard ↻ / manual
  → POST CURSOR_AUTOMATION_QA_WEBHOOK_URL  (Authorization: Bearer CURSOR_AUTOMATION_QA_WEBHOOK_TOKEN)
  → automation: read thread → verdict → log dashboard + brief
  → only if implement gate passes: fix + test + guard + verify:deploy + push + BRIEF.md
```

Webhook: `https://api2.cursor.sh/automations/webhook/03c21147-b824-11f1-977f-f6b8f2fcf9b2`

Only **gemini** fires the webhook (`lib/landbot/handle-inbound.ts` → `scheduleCursorAutomationQa`). The `landbot` repo must not — it would double-run every handoff.

## Vercel env (gemini — production only; previews must never start a run that pushes main)

```
CURSOR_AUTOMATION_QA_ENABLED=1
CURSOR_AUTOMATION_QA_TRIGGERS=human_assign,bot_failure
CURSOR_AUTOMATION_QA_WEBHOOK_URL=https://api2.cursor.sh/automations/webhook/03c21147-b824-11f1-977f-f6b8f2fcf9b2
CURSOR_AUTOMATION_QA_WEBHOOK_TOKEN=crsr_...   # Generate auth header on this same automation
```

Set / rotate with `WEBHOOK_TOKEN=crsr_... ./scripts/set-vercel-qa-env.sh` (also removes retired `*_ANALYZE_*`, `*_IMPLEMENT_*`, `CURSOR_AUTOMATION_WEBHOOK_URL`). Redeploy after changing.

URL without token = disabled (Cursor would 401).

## Automation secrets (Cursor → automation → Secrets)

Same values as Vercel production:

```
AGENT_SUPABASE_URL
AGENT_SUPABASE_SERVICE_ROLE_KEY
CRON_SECRET
```

- Supabase keys → `read-hom-conversation.ts` and `qa:log`.
- `CRON_SECRET` → `log-qa-automation-commit.ts` marks the dashboard row "implemented".

## Verify

```bash
npx tsx scripts/verify-qa-automation-env.ts
npx tsx scripts/e2e-verify-qa-automations.ts          # sends test:true → run replies "webhook OK"
```

## Repo binding

Create/edit the automation at **https://cursor.com/automations** in a browser (not the IDE panel). Repository `adar-commits/gemini`, branch `main`. Local clone remote must be `https://github.com/adar-commits/gemini.git` without `core.sshCommand`, otherwise Cursor stores a `github-adar` host and runs fail with 400.

## Instructions (paste into the automation)

<!-- paste-block:start -->
```
# HoM self-improve automation — QA → Analyze → Brief → Develop

Repo: adar-commits/gemini · branch main only. Never create branches or worktrees. Never force-push. Never amend.

Trigger: gemini production POSTs here on every bot → human handoff (trigger=human_assign) and every never-stuck reply (trigger=bot_failure). /dashboard/qa retry (↻) and the manual dashboard trigger send the same payload.

Payload (JSON body):
conversation_url, session_id, landbot_customer_id, trigger, handoff_action?, last_user_message?, last_bot_reply?,
event_window_since (ISO — analyze ONLY messages at/after this time), event_window_reason (trainer_reset|agent_reset|opened_at|tail_fallback),
event_window_message_count (~5–40 in scope), total_message_count (lifetime thread size — ignore for analysis),
idempotency_key, phone_last4, sent_at, test?

Target: one QA event = one short incident, not the lifetime WhatsApp thread. Analyze in ~1–2 minutes.

Required automation secrets (same values as Vercel production): AGENT_SUPABASE_URL, AGENT_SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET.

## 0. Smoke test
If the payload has "test": true → reply exactly "webhook OK <session_id>" and stop. No reads, no logs, no edits.

## 1. Bootstrap (every run)
Run `npm ci` if node_modules is missing. Read in full:
- .cursor/rules/conversation-fix-playbook.mdc
- .cursor/rules/structured-vs-llm-routing.mdc
- .cursor/rules/qa-automation-hard-bans.mdc
- .cursor/skills/qa-teach-plan-implement/SKILL.md
- .cursor/automations/hom-conversation-qa/BRIEF.md (recent fixes — duplicate check)

## 2. QA — read the event window (whole incident, not the lifetime thread)
npx tsx scripts/read-hom-conversation.ts <session_id> --since=<event_window_since>
(no event_window_since in payload → use --event-window)
Start from last_user_message / last_bot_reply, then read every customer and bot line + shadow logs inside the window. Never judge from the last turn alone.
Never use --full-thread when total_message_count > 100. If event_window_message_count > 80, analyze the last 40 messages of the window plus shadow for the failing turn.
If the script fails on missing credentials → log step 4 with --outcome no_action --cause "חסרים סודות Supabase באוטומציה" and stop.

## 3. Analyze — exactly one verdict
- false_alarm — customer wanted a human; the bot behaved correctly.
- already_covered — same bug class fixed in the last 7 days (BRIEF.md / commit-log.jsonl).
- too_risky — fix would touch routing policy, gender forms, customer-facing semantics, or needs a product decision. Also any risk_score ≥ 8.
- ask_operator — Hebrew policy or fix necessity is ambiguous. Write 1–3 multiple-choice operator questions. Do not guess.
- real_failure — clear bot mistake with an obvious fix layer.

Write root_cause and fix_plan in easy Hebrew (short sentences, no jargon) — the dashboard shows them as הבעיה / הפתרון.
Name one fix_layer: prompt | hints | tool_guard | pre_turn | runtime. risk_score 1–10.

IMPLEMENT GATE — go to step 5 only if ALL are true:
- verdict real_failure, confidence high
- fix_layer set, fix_plan has 1–3 steps, none uses customer-text regex or reply sanitizers
- risk_score ≤ 7, and the fix is required (not a nice-to-have, style tweak, or speculative hardening)
Otherwise the run ends after step 4. If unsure → ask_operator.

## 4. Brief — log the analysis (always)
npm run qa:log -- --phase analyze --session <session_id> --trigger <trigger> \
  --outcome <false_alarm|already_covered|too_risky|ask_operator|chained|no_action> \
  --verdict <verdict> --confidence <high|medium|low> --risk <1-10> \
  --cause "<root_cause, Hebrew>" \
  --fix-layer <layer> --fix-plan "<step 1>|<step 2>" \
  --questions "<question 1>|<question 2>" \
  --idempotency-key "<idempotency_key from payload>"
Omit flags that do not apply. --outcome chained means "gate passed, implementing now" — use it only when the gate passed.
Reply in chat: verdict · one-sentence cause · risk (mention event_window_message_count vs total_message_count on large threads). If the gate did not pass → stop here.

## 5. Develop (gate passed only)
1. Apply the smallest change in the named fix_layer only. Allowed files: lib/hom-agent/prompts/hom-bot.md, lib/hom-agent/conversation-hints.ts, lib/hom-agent/tools/*.ts, lib/agents/order-lookup.ts, lib/agents/service-intake.ts, lib/hom-agent/pre-turn.ts (existing pending-state helpers only), runtime files only for fix_layer runtime.
2. Do not change gender forms (לך/לכם), customer-facing meaning, or Hebrew tone beyond what fix_plan requires. No drive-by refactors.
3. Add one fixture test named after the scenario + session_id in lib/hom-agent/__tests__/ or lib/agents/__tests__/ that replays the timeline and asserts the action and that the wrong sentence / pivot is absent.
4. npm run guard:qa-fix — must pass.
5. npm run verify:deploy — must pass.
   If 4 or 5 fails and no allowed fix remains: `git checkout -- . && git clean -fd lib`, then
   npm run qa:log -- --phase implement --session <session_id> --trigger <trigger> --outcome failed_guard --cause "<why, Hebrew>" --idempotency-key "<idempotency_key>"
   and stop with "no action".
6. git add -A && git commit -m "fix(qa): <short English summary> (<session_id>)" && git push origin main
   (push the fix on its own first — Vercel's prebuild guard checks the latest commit).
7. npx tsx scripts/log-qa-automation-commit.ts --sha "$(git rev-parse HEAD)" --session <session_id> --trigger <trigger> --cause "<root_cause, Hebrew>" --files "<comma-separated touched files>"
   (appends BRIEF.md + commit-log.jsonl and marks the dashboard row implemented via CRON_SECRET).
8. git add .cursor/automations/hom-conversation-qa/BRIEF.md .cursor/automations/hom-conversation-qa/commit-log.jsonl && git commit -m "chore(qa): log implement commit <sha7> for <session_id>" && git push origin main
9. Reply: cause (1 sentence) · files touched · fix commit sha · revert: npm run qa:vanish -- <sha> · https://gemini-xi-one-77.vercel.app/dashboard/qa

## Hard stops — no commit, reply "no action" + reason
- The only fix needs new Hebrew intent regex on customer text, a reply sanitizer (sanitize* / validate-reply.ts stripping), a new runStructured*PreTurn arm, or keyword routing on the latest line.
- Policy is ambiguous (should be ask_operator), or duplicate of a recent BRIEF.md fix.
- guard:qa-fix or verify:deploy fails.
- No new docs/markdown besides BRIEF.md and commit-log.jsonl.

Operator revert: "vanish commit <sha>" → npm run qa:vanish -- <sha>.
```
<!-- paste-block:end -->

## Event window

Production sends `event_window_since` = newest of: last trainer `איפוס`, agent `reset_at`, CRM `opened_at` (`lib/landbot/qa-event-window.ts`). The run reads only that window (~5–40 messages); `total_message_count` is informational.

## Triggers

| Trigger | When |
|---------|------|
| `human_assign` | Rep handoff (`human_service` / `human_sales`) |
| `bot_failure` | Never-stuck: "לא הצלחתי להבין את ההודעה…" |
| `manual` | `/dashboard/qa` → manual trigger by conversation ID |

Trainer `לימוד גוקו` → same webhook (test).

## Operator briefing & revert

- **Brief:** `BRIEF.md` (plain language, updated after each fix push)
- **Full log:** `commit-log.jsonl`
- **Revert:** `npm run qa:vanish -- <commit-sha>` or tell any agent: **vanish commit `<sha>`**
