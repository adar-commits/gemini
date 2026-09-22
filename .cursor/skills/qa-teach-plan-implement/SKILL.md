---
name: qa-teach-plan-implement
description: >-
  QA a real HoM chat from a service.hom-group.co.il/conversations URL, then
  plan and implement an LLM-language fix (prompt, turn hints, tool return
  shape) without new Hebrew intent regex or reply sanitizers. Use when the
  user pastes a service.hom-group.co.il conversation link, asks to fully read
  a chat, or asks to teach the HoM agent from a real thread.
---

# QA → teach/plan → implement

Operator pastes `https://service.hom-group.co.il/conversations/<id>`. Read the whole thread before any edit. Teach the model why it chose wrong. Do not dumb the agent with new customer-message regex or reply sanitizers.

Before editing, read `.cursor/rules/conversation-fix-playbook.mdc` and `.cursor/rules/structured-vs-llm-routing.mdc`. This skill is the gate and the efficiency plan; those rules are the bans.

Stay on `main`. After code changes: `npm run verify:deploy`, commit, push, confirm the Vercel production deploy is not Error.

## 1. QA — read the thread

Extract `<id>` from the URL. Run:

```bash
npx tsx scripts/read-hom-conversation.ts <id>
```

If that reports missing credentials, query Landbot Supabase project `walklyxhkhrdzbkfhtez` with `execute_sql` (same three reads: `conversations`, `messages`, `hom_agent_messages`, `hom_agent_shadow_logs`). Match `session_id`, `landbot_customer_id`, and `conversation_ref` to `<id>`. Read every customer and bot line, not a sample.

Then grep the exact bot sentence that matters and name the function that emitted it (tool reply vs model prose). If that sentence shows up only on a later turn that repeats a good answer, also check `replaceRepeatedReply` in `lib/hom-agent/validate-reply.ts` — it rewrites an identical reply into a handoff offer. A complete status answer may repeat; that rewrite must not open a human ticket. ERP receipt/tracking templates (`documents.carpetshop.co.il`, `orderID=`) are often **assistant** messages, not customer pastes — read those for an order id the bot already has.

**URL only, no complaint:** report the timeline and the code path. Stop. Wait for what is wrong.

**URL plus what is wrong:** the complaint is the behavior spec. Do not ask them to repeat it. Continue to plan and implement in the same turn.

## 2. Teach / plan — language, not parsers

Name one primary layer, in this order:

| Layer | Edit |
|---|---|
| LLM teaching | `lib/hom-agent/prompts/hom-bot.md`, `lib/hom-agent/conversation-hints.ts` |
| Tool return shape | `lib/hom-agent/tools/*.ts`, `lib/agents/order-lookup.ts`, `lib/agents/service-intake.ts` — thread state, not customer wording |
| Pending-state bind | `lib/hom-agent/pre-turn.ts` — only an existing pending helper (`isHumanHandoffPending`, `isOrderConfirmationPending`, `isPureHandoffAffirmation`, …) |
| Runtime | inactivity / CRM assign, only when the timeline shows ping, close, or assign stole the turn |

Plan the smallest change that makes the next similar turn correct:

- If a tool already returns the customer sentence, fix that return. Add one prompt line so the model does not contradict it.
- If the model picked the wrong action or flow, add one binding rule and one hint gated on thread state that already exists.
- If Hebrew policy is ambiguous, AskQuestion (≤10). Read `docs/intent-routing-audit.md` first. Do not guess.

Do not add a new Hebrew regex on the customer message, a reply sanitizer, or a one-off intent classifier. Do not write a plan file.

## 3. Implement

1. Edit that layer only.
2. Add one fixture named after the scenario and conversation id (`lib/hom-agent/__tests__/` or `lib/agents/__tests__/`). Replay the timeline. Assert **action** and that the wrong sentence or pivot is absent.
3. `npm run verify:deploy` from the workspace root. Do not push on failure.
4. Commit and push `main`.
5. Confirm the Vercel production deployment for that commit is READY, not Error.

Reply with the cause (which layer, which sentence), the teaching in one or two sentences, and that it is live. Do not recap the whole thread.

## Keep this skill current

After every use, if the run needed a step this file does not say, update `SKILL.md` in the same commit. Typical gaps: where the thread is stored, which function emitted the bad sentence, a layer that should have been preferred, or a ban that was nearly broken. Do not add a step that only restates the playbook. Leave the file alone when this run followed it cleanly.
