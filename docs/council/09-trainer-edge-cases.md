# Trainer T1 — Edge Case Specialist

## Misleading patterns the old bot fell into

| Trap | Wrong behavior | Correct behavior |
|------|----------------|------------------|
| `"שירות לקוחות"` alone | Silent `shipping` action | Topic prompt — stay in bot |
| `"תודה"` | Silent `end` | Warm reply — conversation stays open |
| `"לא מרוצה"` after delivery | Service + order lookup first | FAQ return/exchange options first |
| `"התאמת מחיר"` in long thread | Sales intake quiz | FAQ credit/refund policy → Service if insist |
| `"מתי מגיע?"` ambiguous | Sometimes FAQ, sometimes API | **Strict:** MY order → API; general times → FAQ |
| Landbot `"פרטים נוספים לגבי X"` | FAQ inventing sizes | URL request → Sales handoff |
| Sticky `lastAgent=sales` | Credit thread stuck in quiz | Re-evaluate every message — credit → FAQ |
| Orchestra advisors | Conflicting brief injected | **Removed** — one spec only |
| Promotions in KB | Bot quotes expired campaigns | **Never** — Sales human only |
| `"?"` after stuck thread | Empty shipping | Casual ping reply or clarify |

## Special-case binding rules

1. **Short replies** (`כן`, `לא`, numbers, SKU, URL) bind to last **non-inactivity** assistant message.
2. **Inactivity messages** (`עדיין כאן?`, close notice) are NOT pending questions for binding.
3. **Multi-intent:** Service (defect) > Shipping (my order) > Sales > FAQ > clarify.
4. **Policy-before-action:** cancel/return/exchange/address change → FAQ until customer confirms execution.
5. **Brand split:** Ask carpetshop vs pozitiveshop when Pozitive-only rules apply (returns at stores only).

## Sticky agent escape hatches

Break sticky specialist when message matches:
- New department intent (shipping status, branch list, purchase, policy)
- Conversation closing / thanks
- Bare CS opener
- Dissatisfaction without defect (→ FAQ even if was in Service)
