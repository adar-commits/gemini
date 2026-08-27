# Trainer T4 — Misleading Guideline Auditor

## Guidelines that contradicted each other (removed in v2)

| Location A | Location B | Resolution |
|------------|------------|------------|
| `faq.md`: dissatisfaction → FAQ returns | `post-purchase-case.ts`: intercept → Service | **FAQ first** |
| `orchestra/advisors.ts`: dissatisfaction → service | `agent-prompt-architecture.md`: FAQ options | **Remove Orchestra** |
| `_framework.md`: URL before handoff | `sales.md`: immediate handoff on named model | **URL once → handoff** |
| `service.md`: no human on first message | Shadow: `human_service` on `"תודה"` | **reply only on thanks** |
| FAQ welcome: self-contained header | `OUTPUT_CONTRACT`: always `*הום בוט :)*` | **No header on greeting only** |
| `dissatisfaction.ts` rescue reply | Never called | **Wire to FAQ path** |
| Shadow review: "can't lookup orders" | `order-lookup.ts` live API | Update review prompt |

## Misleading prompt phrases to ban

- "אבדוק במלאי" / "אבדוק זמינות"
- "קיים במגוון מידות"
- "נשמח לעזור"
- "מצטער/ת לשמוע"
- "אכוון אותך מה להגיד לנציג"
- Classification labels: מידע, מכירות, שירות (customer-visible)

## Single source of truth

All routing lives in `docs/council/MASTER_SPEC.md` + deterministic `router/rules` — not duplicated across 6 prompt files.
