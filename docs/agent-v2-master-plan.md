# HoM Agent v2 — Master Plan (Aug 2026)

## Problem statement

Trainer chats showed the bot felt "stupid" despite expensive models. Root cause was **architecture**, not model IQ:

1. **Shipping hijacked service mid-flow** — any pending order lookup routed to shipping, even during refund/pickup service threads.
2. **Silent customer-facing actions** — `shipping`, route switches, and `master` agent stripped visible Hebrew replies.
3. **LLM-first production mode** — `routing_mode: llm` skipped hybrid interceptors and regex `guessMasterRoute`.
4. **Too many hops** — T0 → Master LLM → silent route → Specialist LLM for turns that should be one deterministic reply.

## Target architecture

```
Customer message
  → Sticky structured flow (order confirm, phone lookup, post-purchase, documents)
  → T0 deterministic (policy, branches, handoffs, shipping when appropriate)
  → guessMasterRoute (hybrid) — department only
  → ONE LLM call only when still ambiguous
  → ALWAYS visible Hebrew reply to customer
```

## Routing mode

**Production:** `routing_mode: hybrid` (see `lib/agents/sql/hom_agent_routing_hybrid.sql`).

| Mode | T0 | Interceptors | guessMasterRoute | Master LLM default |
|------|-----|--------------|------------------|-------------------|
| hybrid | yes | always | yes | fallback only |
| llm | yes (unless structured) | structured only | no | yes |
| regex | yes | always | yes | fallback only |

## Layer responsibilities

### T0 (`runT0DeterministicPaths`)

Exact answers — no LLM:

- Customer service opener → FAQ menu
- Refund timeline vs return location (collision pair)
- Refund status after pickup → service handoff (no order API)
- Warehouse ship from storage → service handoff
- Can't visit branch → home pickup FAQ (not branch list)
- Post-purchase cases (defect, return, pickup wait, missing item)
- Branch review link vs branch list
- Shipping status (when `isShippingLookupContext`)
- Digital documents

### Structured flow (`hasStructuredFlowPending`)

When order confirm / phone lookup / intent confirm / post-purchase marker is active:

- **Continue the owning handler first** before T0 or Master LLM.
- Post-purchase and document flows run **before** shipping interceptors.

### Shipping vs service lookup

| Context | Handler |
|---------|---------|
| "איפה המשלוח" | Shipping + Priority API |
| Refund after pickup done | FAQ handoff — no lookup |
| Service defect / return / pickup wait | Post-purchase case flow |
| Phone confirm mid service thread | Post-purchase — **not** shipping |

Key functions: `isServiceLookupContext`, `isShippingLookupContext`, `shouldHandleOrderShippingFlow`.

### Visible replies

- `shippingResult` uses `action: "reply"` and `agent: "faq"` — customer always sees status text.
- `shipping` removed from `SILENT_ACTIONS`.

### Order confirmation

Accept bare affirmations: כן, נכון, בטח, **אמת**, **אוקיי**, **סבבה**.

## Intent matrix (new / fixed)

| Intent | Example | Handler |
|--------|---------|---------|
| `refund_status` | אספו בשבוע שעבר — מה עם ההחזר? | T0 handoff → human_service |
| `warehouse_ship` | מבקשת לשלוח שטיח באחסנה | T0 service handoff |
| `cant_visit_branch` | לא יכולה להגיע לסניף, כבד | T0 home pickup FAQ |
| `return_pickup_wait` | מחכה לאיסוף שבועיים | Post-purchase service |
| `order_status` | איפה ההזמנה שלי | Shipping (when shipping context) |

## Must NOT match pairs (fixture both sides)

| A | B |
|---|---|
| refund timeline | return location |
| refund status after pickup | shipping order lookup |
| branch review link | branch list |
| return policy | return execution (service) |
| cant visit branch | branch list |
| dissatisfaction | defect |

## Files changed (v2 phase)

| Area | Path |
|------|------|
| Orchestrator | `lib/agents/run-agent.ts` |
| Lookup context | `lib/agents/order-lookup.ts` |
| Intents | `lib/agents/inquiry-intent.ts` |
| Post-purchase | `lib/agents/post-purchase-case.ts` |
| Structured flow | `lib/agent-core/structured-flow.ts` |
| Routing guess | `lib/agents/route-intent.ts` |
| Branches | `lib/agents/branches.ts` |
| Policy replies | `lib/agents/policy-subjects.ts` |
| Silent actions | `lib/agents/types.ts` |
| Tests | `lib/agents/__tests__/agent-v2-fixtures.test.ts` |

## What we demoted (not removed)

- Master LLM as **default** path — hybrid runs T0 + guess first.
- Silent department hops — customer sees Hebrew on every turn.
- Shipping-before-service priority during active service cases.

## What we kept

- Priority order API, document flow, branch reviews, trainer gate, Supabase memory.
- Quality model profile (Sonnet router + Opus specialists).
- First-person bot voice ("אני").

## Deploy checklist

1. Deploy code to Vercel.
2. Run `hom_agent_routing_hybrid.sql` on Landbot Supabase if still `llm`.
3. Re-test trainer phones with fixture messages from failed chats.
