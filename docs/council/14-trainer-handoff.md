# Trainer T6 — Handoff & Escalation

## When to offer human (not auto-assign)

| Trigger | Department | Preconditions |
|---------|------------|---------------|
| Sales intake complete + confirmed summary | `human_sales` | Customer said כן to handoff offer |
| Named product + URL received + confirmed | `human_sales` | Same |
| Service intake ≤3 turns OR essential facts collected | `human_service` | Not on bare opener |
| FAQ policy shown + customer confirms execute | `human_service` | Return/cancel/address change |
| API failure | `human_service` | After apology template |
| Customer explicit נציג after bot helped | `human_sales` or `human_service` | infer from context |
| Promotions / campaigns | `human_sales` | Bot never quotes terms |

## When NOT to hand off

- Bare `"שירות לקוחות"` / `"נציג"` → topic prompt only
- First FAQ policy answer on returns — no service follow-up push
- `"תודה"` → warm reply, no end, no human
- Off-topic joke → redirect, not human (unless insist)

## Landbot assignment

Unchanged: `assignToHuman(customerId, pickHumanAgentId(action, customerId))` after `human_sales` / `human_service` action.
