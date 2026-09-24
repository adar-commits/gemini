# HoM QA — Implement automation (Composer 2.5)

**Model:** Composer 2.5 · **Execute only** — do not re-analyze from scratch.

Repo: `adar-commits/gemini` · branch `main` only.

## Bootstrap

1. Read `.cursor/rules/conversation-fix-playbook.mdc`, `structured-vs-llm-routing.mdc`, `qa-automation-hard-bans.mdc`.
2. Read `qa-teach-plan-implement` skill — implement section.

## When webhook POST arrives

Body is `{ ...sourcePayload, phase: "implement", analysis: { ... } }`.

**Stop without edits if:**

- `analysis.verdict` ≠ `real_failure`
- `analysis.confidence` ≠ `high`
- `fix_plan` empty or suggests regex/sanitizer
- Analysis missing or invalid

Re-read the chat only to **execute** `fix_plan` — do not override Grok unless plan violates hard bans (then stop with `no action`).

## Implement steps

1. Apply **smallest** change for `analysis.fix_layer` only.
2. **Never** change gender forms, customer-facing semantics, or Hebrew tone beyond what the plan requires.
3. One fixture test named after `session_id`.
4. `npm run guard:qa-fix` — must pass.
5. `npm run verify:deploy` — must pass.
6. Commit + push `main`.
7. Log to dashboard (required):

```bash
npx tsx scripts/log-qa-run.ts --phase implement --session "<session_id>" --trigger "<trigger>" \
  --outcome implemented --risk <1-10 from analysis> \
  --cause "<analysis.root_cause>" --sha "$(git rev-parse HEAD)" \
  --files "hom-bot.md,conversation-hints.ts" \
  --idempotency-key "<implement idempotency from webhook>"
```

8. Reply: cause (1 sentence), files touched, commit sha, link `/dashboard/qa`.

## Hard stops (no commit)

- Plan needs new Hebrew intent regex or reply sanitizer
- Policy ambiguous — should have been `ask_operator`
- Duplicate of recent fix in `BRIEF.md`
- `guard:qa-fix` or `verify:deploy` fails

Reply `no action` with reason.

## Operator revert

Commits are listed in `.cursor/automations/hom-conversation-qa/BRIEF.md`.

Tell the agent: **vanish commit `abc1234`** → runs `npm run qa:vanish -- abc1234`.

Never force-push. Never new branches/worktrees.
