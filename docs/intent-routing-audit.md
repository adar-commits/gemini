# Intent routing audit (Aug 2026)

> After token optimization, production used `routing_mode: llm` which disabled `guessMasterRoute()` and relied on T0 + Master LLM. This doc maps intents, handlers, and known collision pairs.

## Routing layers (after fix)

| Layer | When | Examples |
|---|---|---|
| **T0** | Every turn (unless structured flow pending) | Refund timeline, review link, branch list, return policy, order lookup |
| **T1 confident** | LLM path only; high-confidence skip | Sales intake trigger, shipping status, document request |
| **T1 guess** | Before Master LLM | `guessMasterRoute()` regex — branches, defects, purchase |
| **Master LLM** | T0 + guess both miss | Ambiguous multi-topic messages |
| **Specialist LLM** | After route | FAQ KB answer, sales intake, service intake |

**Production target:** `routing_mode: hybrid` (see `hom_agent_routing_hybrid.sql`).

---

## Intent matrix

| Intent ID | Customer want | Example Hebrew | Handler | Must NOT match |
|---|---|---|---|---|
| `refund_timeline` | When money/credit arrives | "מסרתי בסניף, מתי אקבל החזר" | T0 → `buildRefundTimelinePolicyReply` | `return_location` |
| `return_location` | Where/how to return | "איך מחזירים לסניף" | T0 branch list + return intro | `refund_timeline` |
| `return_policy` | Rules before acting | "מה מדיניות החזרה" | T0 → portal-first policy | `return_request` (service) |
| `return_request` | Execute return now | "רוצה להחזיר את השטיח" (post-receipt) | Service intake | `return_policy` |
| `branch_review_link` | Google writereview URL | "חוות דעת על סניף סגולה", "לינק לדירוג" | T0 → `branch-google-reviews.ts` | `branch_list` |
| `branch_list` | Addresses / hours | "איזה סניפים יש", "כתובת סניף נתניה" | T0 → `buildBranchReplyForText` | `branch_review_link` |
| `branch_inventory` | SKU in which store | "יש 31501090-200290 בסניפים?" | T0 → Priority API | Sales handoff |
| `order_status` | Where is my shipment | "איפה ההזמנה", "מה זה אומר" after status | Shipping flow + clarification | FAQ policy |
| `dissatisfaction` | Don't like it, no defect | "לא מתאים לי" | FAQ rescue → portal | Service defect |
| `defect` | Damage / wrong / missing | "השטיח קרוע", "קיבלתי רק חלק" | Service | FAQ policy |
| `sales_intake` | New purchase help | "רוצה שטיח לסלון", "גדול לנו" | Sales intake | Order lookup |
| `shipping_policy` | Delivery rules/cost | "כמה עולה משלוח" | T0 KB snippet | Order status |
| `service_praise` | Thanks + optional review | "שירות מעולה" | Praise flow → review URL | `branch_review_link` (direct ask) |
| `payments_policy` | Payment methods | "אפשר בביט?" | FAQ (guess or LLM) | — |
| `promotions` | Campaign terms | "יש מבצע 50%?" | FAQ LLM + dated KB | — |
| `human_handoff` | Speak to agent | "נציג" | Context-based sales/service | — |
| `document` | Receipt / invoice | "שלחו קבלה" | Document flow | Shipping status |

---

## T0 coverage (code: `runT0DeterministicPaths`)

- Customer service opener
- Dissatisfaction without defect
- Return policy + refund timeline
- Branch Google review link
- Branch inventory (SKU)
- Branch list / return-to-branch context
- Shipping policy
- Sales photo upload (mid-intake)
- Digital documents
- Post-purchase cases
- Sales intake fast path
- Order shipping lookup
- Service topic switch
- FAQ topic switch (policy subjects)

## LLM-only gaps (need T0 or accept LLM risk)

- Payment methods detail
- Product care (cleaning, shedding)
- Promotions (date-sensitive)
- Privacy / accessibility / terms URLs
- Pozitive vs carpetshop scope
- Website technical issues (partial: hybrid interceptor only)

---

## Collision pairs — highest priority tests

1. **refund_timeline** vs **return_location** — same words `סניף` + `החזר`
2. **branch_review_link** vs **branch_list** — same words `סניף` + positive sentiment
3. **return_policy** vs **return_request** — "רוצה להחזיר" with/without receipt context
4. **order_status** vs **shipping_policy** — "מתי יגיע" generic vs specific order
5. **dissatisfaction** vs **defect** — "לא מתאים" vs "קרוע"
6. **service_praise** vs **branch_review_link** — thanks vs explicit review ask

Fixtures: `lib/agents/__tests__/refund-timeline.test.ts`, `branch-review-link.test.ts`, `council-fixtures.test.ts`.

---

## Phase 2 — questions for product owner (10, not 30)

Answer these when ambiguous; everything else we infer from KB + code.

1. **"רוצה להחזיר"** before policy shown — always FAQ portal-first, or sometimes Service?
2. **Website orders** — never offer Google review link, or is there a generic store link?
3. **באר שבע** (opening soon) — review link, address only, or "not open yet"?
4. **Price match / זיכוי לא הופיע** — FAQ policy or Service case?
5. **Preorder delay** — Shipping lookup or Service complaint?
6. **"נציג"** alone — always Service, or ask one clarifier first?
7. **Pozitive** products — same branch/review map as carpetshop?
8. **After reset** — should bot remember prior order context for review links?
9. **Multi-question** ("מתי משלוח וגם סניפים") — one combined reply or prioritize shipping?
10. Paste **5 real failed chats** — we add each as a permanent fixture test.

---

## Token optimization note

Token plan (Aug 28) added T0 + shorter history (18) + LLM-first default. Side effect: `guessMasterRoute()` was skipped in `llm` mode. Fix: T0 runs for all modes; `guessMasterRoute()` runs before Master LLM; default mode → `hybrid`.
