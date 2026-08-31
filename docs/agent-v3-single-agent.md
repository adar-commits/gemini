# HoM Bot v3 — Single Agent + Tools

> **Supersedes:** `docs/agent-v2-master-plan.md`, hybrid/T0 routing sections in `docs/agent-prompt-architecture.md`, and Master routing in `docs/council/MASTER_SPEC.md`.

## Architecture

One Sonnet-powered agent (`hom-bot.md` + full FAQ KB) handles every substantive customer turn. Live data comes from **tools**, not regex interceptors or silent Master routing.

```
Customer message
  → pre-turn guards (autoresponder, inactivity ack, close)
  → HoM Bot LLM (balanced / Sonnet)
  → optional tools (max 2 steps)
  → structured { reply, action }
  → validate-reply (header, gender, never-stuck)
  → Landbot outbound (always visible Hebrew)
```

## Entry point

| Function | Path |
|----------|------|
| `runCustomerConversation()` | `lib/agents/conversation.ts` |
| `runHomAgentTurn()` | `lib/hom-agent/run-turn.ts` |

Landbot: `lib/landbot/handle-inbound.ts` → `runCustomerConversation()`.

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `AGENT_ENGINE` | v3 (any value except `v2`) | Rollback guard — `v2` throws |
| Supabase `active_profile` | `balanced` | Sonnet for all roles |

`routing_mode` column is **deprecated** — kept in Supabase for compatibility only.

## Output schema

```typescript
{ reply: string, action: "reply" | "human_sales" | "human_service" | "reset" | "end" }
```

No silent `faq` / `sales` / `service` / `ROUTE_TO_*` hops.

## Tools

| Tool | Backend |
|------|---------|
| `lookup_order_status` | `lib/agents/order-lookup.ts` + Priority |
| `lookup_inventory` | `lib/agents/inventory-lookup.ts` |
| `fetch_digital_document` | `lib/agents/digital-document-flow.ts` |
| `get_branch_info` | `lib/agents/branches.ts` |
| `get_branch_review_link` | `lib/agents/feedback-handling.ts` |

## Prompt

Single source: `lib/hom-agent/prompts/hom-bot.md` + `lib/agents/kb/faq.md` every turn.

## Tests

Behavioral fixtures: `lib/agents/__tests__/agent-v2-fixtures.test.ts` (v3 patterns), `refund-timeline.test.ts`, `inquiry-routing-decisions.test.ts`.

## Deleted (v2 brain)

- `run-agent.ts`, `route-intent.ts`, `post-purchase-case.ts`, `master-fallback.ts`
- `confident-route.ts`, `structured-flow.ts`, `safe-run-agent.ts`
- `orchestra/*`, specialist prompts (`master/faq/sales/service.md`)

## Kept unchanged

Landbot integration, Supabase memory, Priority webhook, branches, KB, inactivity, trainer gate.
