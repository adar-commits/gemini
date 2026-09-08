# HoM Bot v3 — Single Agent + Tools

> **Supersedes:** `docs/agent-v2-master-plan.md`, hybrid/T0 routing sections in `docs/agent-prompt-architecture.md`, and Master routing in `docs/council/MASTER_SPEC.md`.

## Architecture

One Sonnet-powered agent (`hom-bot.md` + selective FAQ KB + capped trainer rules) handles every substantive customer turn. Live data comes from **tools**, not regex interceptors or silent Master routing.

**One LLM call per turn** (since Sep 2026 audit): tools and the structured `{ reply, action }` output happen in the same `generateText` call — the system prompt is billed once, not twice.

```
Customer message
  → pre-turn guards (autoresponder, inactivity ack, close)
  → HoM Bot LLM — single call (custom profile / Sonnet 5)
      tools (max 2 rounds) + structured { reply, action } in one pass
  → validate-reply (header, gender, never-stuck)
  → Landbot outbound (always visible Hebrew)
```

### Models (production, Sep 2026)

| Role | Model | Used for |
|------|-------|----------|
| faq (main agent) | `anthropic/claude-sonnet-5` ($2/$10 MTok) | Every substantive reply |
| hard-case agent | `anthropic/claude-opus-5` | Dissatisfaction, policy dispute, multi-intent, complex service |
| router | `anthropic/claude-haiku-4.5` ($1/$5 MTok) | Conversation summaries only |
| error fallback | `anthropic/claude-haiku-4.5` | kb-only pass after tool invoke failure |
| trainer/shadow helpers | `anthropic/claude-haiku-4.5` | Correction parsing, shadow review, autofix |

Supabase `active_profile` = `custom` (see `lib/agents/sql/hom_agent_runtime_production_stack.sql`). Per-role `temperature` from the profile is honored by `invoke.ts`.

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
| Supabase `active_profile` | `custom` | Sonnet main agent + Flash-Lite summaries |

`routing_mode` column is **deprecated** — kept in Supabase for compatibility only.

## Trainer corrections (learned rules)

`לתיקון:` from trainer phones writes `prompt_rule` rows to `hom_agent_learned_rules`.
Since the Sep 2026 audit these rules **are injected** into the v3 system prompt via
`homAgentLearnedRulesSection()` — capped at 20 rules / ~2,400 chars, deduped by
normalized text, newest-wins on conflict. Review new rules periodically:

```sql
select rule_text, status, created_at from hom_agent_learned_rules
where rule_kind in ('prompt_rule','off_topic_exception') and status = 'active'
order by created_at desc;
```

## Policy decisions (owner, Sep 2026)

- **Dissatisfaction (no defect)** → FAQ return/exchange options first, sales-consult offer embedded. Not a Sales handoff.
- **Price match / missing credit** → FAQ policy answer first; Service only if the customer insists.
- **איפוס reset** → clears history *and* `conversation_summary` — no topic bleed into the new session.

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
| `get_campaigns` | `lib/agents/campaign-lookup.ts` + Priority `getCampaigns` |

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
