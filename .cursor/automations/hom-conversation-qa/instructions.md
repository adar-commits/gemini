# HoM self-improve automation (single run)

One Cursor automation does **QA → Analyze → Brief → Develop**.

```
gemini handoff (human_assign) / never-stuck (bot_failure) / dashboard ↻ / manual
  → POST CURSOR_AUTOMATION_QA_WEBHOOK_URL  (Authorization: Bearer CURSOR_AUTOMATION_QA_WEBHOOK_TOKEN)
  → automation: read payload.transcript → verdict → curl dashboard   (no npm, target ≤ 2 min)
  → only if implement gate passes: npm ci + fix + test + guard + verify:deploy + push + BRIEF.md   (target ≤ 4 min)
```

Most events end at the verdict (false alarm / ask operator), so the analyze path never installs dependencies or reads the DB — production ships the event-window transcript in the payload (`lib/landbot/qa-transcript.ts`) and the run reports progress with curl to `/api/agents/qa-runs` and `/api/agents/qa-runs/stage`.

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

## Automation secrets

None. Cursor automations have no secrets store, so each webhook payload carries `callback_token` = HMAC(`CRON_SECRET`, idempotency_key) (`lib/agents/qa-callback-token.ts`). `/api/agents/qa-runs` and `/api/agents/qa-runs/stage` accept it only for that event's key (or the full `CRON_SECRET` for operator scripts).

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

TIME BUDGET — analyze ≤ 2 min, implement ≤ 4 min. Many events arrive; be fast:
- Analyze ONLY from payload.transcript. Do NOT run npm ci, tsx scripts, or DB queries for analysis. Do NOT explore the codebase before the verdict.
- The repo's .cursor/rules (playbook, routing, hard bans) are already loaded — do not re-read them.
- Only the implement path (step 4) installs dependencies.

Trigger: gemini production POSTs here on every bot → human handoff (trigger=human_assign) and every never-stuck reply (trigger=bot_failure). /dashboard/qa retry (↻) and the manual dashboard trigger send the same payload.

Payload (JSON body):
conversation_url, session_id, landbot_customer_id, trigger, handoff_action?, last_user_message?, last_bot_reply?,
transcript (event-window TIMELINE + AGENT TURNS + SHADOW — the whole incident, already filtered),
event_window_since, event_window_reason, event_window_message_count, total_message_count (ignore),
idempotency_key, callback_token, phone_last4, operator_notes?, operator_replies?, previous_analysis?, sent_at, test?

OPERATOR NOTES — if operator_notes is present, a human reviewing the chat wrote what went wrong. Treat it as the behavior spec:
- Verify it against the transcript, then answer it directly in root_cause (agree, or explain in Hebrew why the bot was right).
- It outranks your own guess, but never the hard bans or the implement gate.
- Ambiguous / policy-level request → ask_operator with multiple-choice questions.

OPERATOR REPLIES — if operator_replies is present, you already analyzed this event (previous_analysis) and stopped to wait for the operator; the last item is their newest answer.
- Do not re-analyze from scratch. Start from previous_analysis, apply the answer, and log a new verdict.
- An answer that settles the open question (e.g. gives the missing policy / hours / wording) removes the ambiguity: re-check the gate — it can now pass as real_failure + high.
- An explicit approval ("כן, תתקן" / "מאשר") lets you implement a too_risky or unconfirmed real_failure plan despite risk_score ≥ 8 — but never the hard bans.
- If the answer is "no" / "leave it" → log no_action with the reason and stop. Still unclear → ask_operator again with a sharper question.

No secrets needed. Dashboard calls authenticate with payload.callback_token (valid only for this event). git push uses the repo connection.

DASHBOARD CALLS (curl, never block the run — ignore failures):
STAGE ping (replace <stage> with reading | analyzing | coding | testing):
curl -s -X POST https://gemini-xi-one-77.vercel.app/api/agents/qa-runs/stage -H "Authorization: Bearer <callback_token>" -H "Content-Type: application/json" -d '{"stage":"<stage>","idempotency_key":"<idempotency_key>","session_id":"<session_id>"}'
VERDICT log (JSON body, Hebrew allowed; omit fields that don't apply):
curl -s -X POST https://gemini-xi-one-77.vercel.app/api/agents/qa-runs -H "Authorization: Bearer <callback_token>" -H "Content-Type: application/json" --data-binary @- <<'EOF'
{"session_id":"<session_id>","trigger":"<trigger>","idempotency_key":"<idempotency_key>","phase":"analyze","outcome":"<false_alarm|already_covered|too_risky|ask_operator|chained|no_action>","verdict":"<verdict>","confidence":"<high|medium|low>","risk_score":<1-10>,"root_cause":"<Hebrew>","fix_layer":"<layer>","fix_plan":["<step>"],"operator_questions":["<question>"]}
EOF

## 0. Smoke test
If the payload has "test": true → reply exactly "webhook OK <session_id>" and stop. No calls, no edits.

## 1. Read (≤ 30 s)
STAGE ping: reading.
Read payload.transcript top to bottom. Start from last_user_message / last_bot_reply, then the timeline, agent actions and shadow lines. Never judge from the last turn alone.
Only if transcript is missing: npm ci --no-audit --no-fund && npx tsx scripts/read-hom-conversation.ts <session_id> --since=<event_window_since> — needs DB env the automation does not have; if it fails, VERDICT log outcome no_action with root_cause "חסר תמליל בפיילואד" and stop.

## 2. Analyze — exactly one verdict (≤ 90 s)
STAGE ping: analyzing.
- false_alarm — customer wanted a human; the bot behaved correctly.
- already_covered — same bug class fixed in the last 7 days: check `head -40 .cursor/automations/hom-conversation-qa/BRIEF.md` only if you suspect it.
- too_risky — touches routing policy, gender forms, customer-facing semantics, or needs a product decision. Also any risk_score ≥ 8.
- ask_operator — Hebrew policy or fix necessity is ambiguous. 1–3 multiple-choice operator_questions. Do not guess.
- real_failure — clear bot mistake with an obvious fix layer.
root_cause and fix_plan in easy Hebrew (short sentences, no jargon) — shown as הבעיה / הפתרון.
fix_layer: prompt | hints | tool_guard | pre_turn | runtime. risk_score 1–10.

IMPLEMENT GATE — continue to step 4 only if ALL are true:
- verdict real_failure, confidence high
- fix_layer set, fix_plan 1–3 steps, none uses customer-text regex or reply sanitizers
- risk_score ≤ 7 (or the operator explicitly approved in operator_replies) and the fix is required (not a nice-to-have, style tweak or speculative hardening)
If unsure → ask_operator.

## 3. Brief — log the verdict (always)
VERDICT log. outcome = the verdict, or "chained" when the gate passed ("implementing now").
Reply in chat: verdict · one-sentence cause · risk. If the gate did not pass → STOP. The run is done.

## 4. Develop (gate passed only, ≤ 4 min)
STAGE ping: coding.
npm ci --no-audit --no-fund --prefer-offline
1. Smallest change in the named fix_layer only. Open only the files the fix needs: lib/hom-agent/prompts/hom-bot.md, lib/hom-agent/conversation-hints.ts, lib/hom-agent/tools/*.ts, lib/agents/order-lookup.ts, lib/agents/service-intake.ts, lib/hom-agent/pre-turn.ts (existing pending-state helpers only), runtime files only for fix_layer runtime.
2. Do not change gender forms (לך/לכם), customer-facing meaning or Hebrew tone beyond fix_plan. No drive-by refactors.
3. One fixture test named after scenario + session_id in lib/hom-agent/__tests__/ or lib/agents/__tests__/ — replay the timeline, assert the action and that the wrong sentence / pivot is absent. Run only that test file while iterating.
4. STAGE ping: testing. Then npm run guard:qa-fix — must pass.
5. npm run verify:deploy — must pass (it already runs the prebuild test suites; don't run them separately).
   If 4 or 5 fails and no allowed fix remains: git checkout -- . && git clean -fd lib, then VERDICT log with "phase":"implement","outcome":"failed_guard","root_cause":"<why, Hebrew>", and stop with "no action".
6. git add -A && git commit -m "fix(qa): <short English summary> (<session_id>)" && git push origin main
7. npx tsx scripts/log-qa-automation-commit.ts --sha "$(git rev-parse HEAD)" --session <session_id> --trigger <trigger> --cause "<root_cause, Hebrew>" --files "<comma-separated touched files>" --key "<idempotency_key>" --token "<callback_token>"
   (marks the dashboard event "נדחף ל-main", appends BRIEF.md + commit-log.jsonl)
8. git add .cursor/automations/hom-conversation-qa/BRIEF.md .cursor/automations/hom-conversation-qa/commit-log.jsonl && git commit -m "chore(qa): log implement commit <sha7> for <session_id>" && git push origin main
9. Reply: cause (1 sentence) · files · fix commit sha · revert: npm run qa:vanish -- <sha>

## Hard stops — no commit, reply "no action" + reason
- The only fix needs new Hebrew intent regex on customer text, a reply sanitizer (sanitize* / validate-reply.ts stripping), a new runStructured*PreTurn arm, or keyword routing on the latest line.
- Policy is ambiguous (should be ask_operator), or duplicate of a recent BRIEF.md fix.
- guard:qa-fix or verify:deploy fails.
- No new docs/markdown besides BRIEF.md and commit-log.jsonl.
```
<!-- paste-block:end -->

## Event gauge (7 stages)

`lib/agents/qa-event-stages.ts` → `components/qa/qa-event-gauge.tsx`:

| # | Stage | Stamped by |
|---|-------|-----------|
| 1 | נשלח לאוטומציה | webhook (`event_at`) |
| 2 | קריאת השיחה | STAGE ping `reading` (`POST /api/agents/qa-runs/stage`) |
| 3 | ניתוח | STAGE ping `analyzing` |
| 4 | החלטה | VERDICT log (`POST /api/agents/qa-runs`, stamps `analyze_completed_at`) — amber "waiting" on ask_operator / too_risky, fix stages skipped on false_alarm |
| 5 | תיקון קוד | STAGE ping `coding` / outcome `chained` |
| 6 | בדיקות ו-build | STAGE ping `testing` |
| 7 | נדחף ל-main | `log-qa-automation-commit.ts` (outcome `implemented`) |

Retry (↻) reuses the event's idempotency key, resets the stages and re-sends the operator's notes.

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
