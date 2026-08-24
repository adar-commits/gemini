# Bot Orchestra

Parallel sub-agents enrich every non-trivial turn before the replying specialist runs.

## Conversation phases

| Phase | Meaning |
|-------|---------|
| `opening` | First hello, no business ask yet |
| `discovery` | Understanding what customer wants to buy |
| `sales_intake` | Structured quiz (space → style → budget) |
| `policy_info` | FAQ / KB (returns, hours, shipping policy) |
| `product_specific` | Named model, stock, URL |
| `shipping_tracking` | Where is my order / when arrives |
| `post_purchase_service` | Defect, wrong item, invoice |
| `handoff_pending` | Bot asked "transfer to human?" |
| `dissatisfaction` | Unhappy but not necessarily defect |
| `closing` | Thanks / goodbye |
| `off_topic` | Unrelated trivia |
| `ambiguous` | Needs orchestra advisors |

## Sub-agents (parallel, ~4000ms budget)

| Advisor | Role |
|---------|------|
| **Phase Scout** | Deep phase + confidence |
| **Intent Router** | Best department / route |
| **Risk Guard** | Hallucination, policy, handoff risks |
| **Strategy Coach** | One next step + optional single question |

Deterministic layer (0ms) runs first: entities, phase hint, route hint.

## Performance

- Skipped on: sales intake fast path, regex routes, short greetings, learned `fast_reply`
- Runs only before AI routing/reply (after all hard-coded fast paths)
- 4 advisors in **parallel** via `gemini-2.5-flash-lite`
- Budget: `ORCHESTRA_BUDGET_MS` (default 4000, max 4500)

## Env

- `ORCHESTRA_ENABLED=1` (default on)
- `ORCHESTRA_BUDGET_MS=4000`
- `ORCHESTRA_MODEL=google/gemini-2.5-flash-lite`

## Flow

```
Customer message
  → fast paths (learned rules, intake, shipping templates)
  → [Orchestra: 4 parallel advisors]
  → ORCHESTRA BRIEF injected into specialist/master prompt
  → single customer reply
```
