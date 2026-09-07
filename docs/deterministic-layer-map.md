# Deterministic layer map — every path that can answer without (or over) the LLM

> Created during the Sep 2026 audit. Rule of thumb: **templates own state and exact
> facts; the model owns language and judgment.** Anything that violates this rule
> has caused a "the bot is stupid" incident.

## Layer 1 — Pre-turn guards (reply BEFORE the LLM runs)

`lib/hom-agent/pre-turn.ts` → `runPreTurnGuards`

| Guard | Trigger | Risk | Status |
|---|---|---|---|
| Voice message notice | Any voice note | Low — fixed capability statement | Keep |
| Autoresponder ignore | Away-message patterns from other businesses | Low — tight patterns + brand exclusion | Keep |
| Inactivity still-here / defer acks | Reply to an inactivity ping | Low — gated on ping pending | Keep |
| Handoff confirm / decline | כן/לא/תעביר after a handoff offer | Low — gated on pending offer; vocabulary extended Sep 2026 (תעביר, אפשר להעביר…) | Keep |
| Thanks acknowledgment | תודה/סתדרתי closings | Low — excludes "תודה אבל/גם/רציתי" | Keep |

## Layer 2 — Structured order pre-turn (the state machine)

`runStructuredOrderLookupPreTurn` → `resolveOrderShippingReply`

Load-bearing: its templates ("האם רשומה על המספר…", "נדמה לי שמצאתי…", "בדקתי,…")
are re-parsed from history to track flow state. **Do not free-text them.**

Hardened Sep 2026:
- `stripMediaAndUrls` runs before every phone/order-number extraction — media URLs
  contain the Landbot customer id, which matches the mobile-phone pattern
  (room-photo → "לא מצאתי הזמנות" incident).
- A typed phone only binds the turn when order context exists (pending step or
  order/shipping ask). "תתקשרו אליי 05X…" reaches the LLM.
- Candidate orders exclude cancelled / ₪0 / negative credit rows.
- Purchase-completion statements ("עשיתי את ההזמנה דרך הנציג") never start a lookup.

## Layer 3 — Tool replies that override the model's composition

`extractDeterministicToolReply` in `lib/hom-agent/invoke.ts` sends any tool result
with `{ok, reply}` verbatim, discarding the model's own final answer.

| Tool | Mode | Rationale |
|---|---|---|
| `lookup_order_status` | **Override** (flow) | State-machine templates + exact live status |
| `lookup_inventory` | **Override** (flow) | SKU-request templates parsed from history |
| `fetch_digital_document` | **Override** (flow) | Multi-step document flow state |
| `get_campaigns` | **Data-mode** (override only if customer asked about מבצעים) | Canned pitch hijacked greetings/handoffs |
| `get_branch_info` | **Data-mode** | Pure facts — model answers the actual question |
| `get_branch_review_link` | **Data-mode** | Pure fact (URL, copy exactly) |

Data-mode = tool returns `…Info` + `note`; the model composes, copying facts exactly.

## Layer 4 — Post-LLM reply surgery

`lib/hom-agent/validate-reply.ts` — string-level sanitizers (header, gendered
address, hallucinated portal URLs, redundant handoff confirms) plus:

- **Anti-repeat guard** (Sep 2026): an exact repeat of the previous assistant
  message is replaced with an apology + human-handoff offer. A repeated reply can
  never reach a customer.

## Layer 5 — Proactive messages (no customer message at all)

- Inactivity ping/close (`inactivity-cron.ts`, `inactivity-watcher.ts`) — 15 min
  ping, +30 min close, Landbot archive on close. Idle scan has a 48h recency
  floor + self-cleaning sweep (starvation fixed Sep 2026).
- Priority API wait bubble ("אני על זה — עוד כמה רגעים 🙏") — recognized and
  skipped by all history scanners via `isPriorityApiWaitMessage`.

## Incident log (why this map exists)

| Date | Incident | Layer | Fix |
|---|---|---|---|
| Sep 7 | Stale summary after איפוס | Memory | Clear summary on reset |
| Sep 7 | History window pinned to oldest 12 messages | Memory | Newest-N descending |
| Sep 7 | Campaigns pitch on greetings / handoff requests ×4 | 3 | Campaigns data-mode + no speculative tools |
| Sep 7 | "עשיתי את ההזמנה" → phone verification | 2+3 | Purchase-statement guard |
| Sep 7 | Same reply repeated 4× while customer begged for a human | 3+4 | Anti-repeat guard + תעביר vocabulary |
| Sep 7 | Room photo → "לא מצאתי הזמנות" (customer id as phone) | 2 | stripMediaAndUrls + context-gated phone binding |
| Sep 7 | No conversation ever pinged/closed (scan starvation) | 5 | Recency floor + sweep + Landbot archive |

## Rules for future changes

1. New tool → prefer **data-mode**. Override only if the reply text is parsed
   back from history (state machine) or contains live facts the model must not
   paraphrase.
2. New pre-turn guard → must be gated on a pending state it itself created, and
   run extraction on `stripMediaAndUrls`-sanitized text.
3. Never add a canned reply for anything requiring social judgment.
