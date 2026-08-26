# HoM Agent Prompt Architecture

> Master plan for how each Landbot agent should think, route, speak, and hand off.
> Implemented in `lib/agents/prompts/` and assembled by `lib/agents/prompts.ts`.

---

## 1. Why this exists

The HoM bot is not one assistant — it is a **team of specialists** behind one voice (*הום בוט :)*).
Customers speak in messy Hebrew, switch topics mid-flow, and rarely name the department they need.
Prompt quality is measured by **outcomes**, not eloquence:

| Failure mode | Business cost |
|---|---|
| Wrong routing | Customer repeats themselves; CS/Sales rework |
| Hallucinated facts | Wrong stock/price/policy → trust loss, refunds |
| Intake loops | Abandonment before human handoff |
| Tone drift | Gendered/fluffy/robotic Hebrew → brand damage |
| Bad handoff timing | Human gets empty case or customer stuck with bot |

This document defines the **cognitive architecture** every agent prompt must follow.

---

## 2. Five-layer prompt model

Every agent system prompt is assembled in this order (see `prompts.ts`):

```
┌─────────────────────────────────────────┐
│ L1  NORTH STAR — real goal & anti-goals │  per-agent block
├─────────────────────────────────────────┤
│ L2  DECISION TREE — first 3 steps/turn  │  per-agent block
├─────────────────────────────────────────┤
│ L3  SHARED FRAMEWORK — universal rules    │  _framework.md
├─────────────────────────────────────────┤
│ L4  INTENT — want, not wording          │  _intent-decoder.md
├─────────────────────────────────────────┤
│ L5  DOMAIN PLAYBOOK — flows & scripts   │  sales/faq/service/master.md
├─────────────────────────────────────────┤
│ L6  OUTPUT CONTRACT — JSON + actions    │  prompts.ts append
└─────────────────────────────────────────┘
```

### Layer 1 — North Star (per agent)

**Not** "you are a sales bot." **Instead:** the business outcome this agent owns.

| Agent | Real goal | Success looks like | Anti-goals (never) |
|---|---|---|---|
| **Master** | Put each message in exactly one lane | Silent correct route every turn | Speak to customer; keyword-route; stay on wrong agent |
| **FAQ** | Deliver **exact** policy/store facts from KB | One correct answer, human wrap-up | Invent policy; collect order details; emotional theater |
| **Sales** | Collect **minimum** facts for human consultant OR verified KB answer | Right handoff with summary OR precise fact | Fake catalog/stock; design opinions; website price-filter redirect |
| **Service** | Collect **minimum** case facts → human CS | ≤3 intake turns then transfer | Promise outcomes; repeat policy; diagnose photos |

### Layer 2 — Decision tree (first seconds of each turn)

Each specialist runs this **before** generating text:

```
1. CONTEXT — What did the bot last ask? Is this a short answer to that?
2. INTENT  — Continuing current flow OR switching department?
3. GROUND  — Is the answer in KB / collected context / nowhere?
   → KB fact     : answer exactly
   → Need human  : handoff path
   → Unknown     : one clarifying question; then human if still unclear (never guess facts)
4. ACT        — reply | silent route | human_*
5. VALIDATE   — header, one question max, no invented facts
```

Master runs steps 1–2 only, then triggers exactly one `ROUTE_TO_*`.

### Layer 3 — Shared framework (`_framework.md`)

Universal rules injected into all conversational agents:

- Every-message intent check
- Product/stock handoff (no catalog access)
- Off-topic handling
- Mid-conversation uncertainty
- Media handling
- Voice & header contract
- Anti-hallucination oath

### Layer 4 — Intent (`_intent-decoder.md`)

Read the **want** (info / buy / fix / track / human). Examples illustrate the shape — they are not a closed dictionary. New Hebrew phrasing still routes by the want. "Got the product + any issue X" is Service; the specific X is a human's job.

Examples:

| Customer says | Often means | Route |
|---|---|---|
| "נציג" (alone) | CS for unclear case | Service |
| "נציג לגבי מחיר" | Sales human | Sales → human_sales |
| "לא מתאים לי" (after delivery) | Return/exchange **policy** first | FAQ |
| "השטיח קרוע" | Post-purchase defect case | Service |
| "איפה ההזמנה" | Tracking | Shipping |
| "כמה עולה" (no model) | Purchase exploration | Sales intake |
| "יש קזבלנקה במלאי?" | Catalog check without SKU → human | Sales handoff |
| "יש 31501090-200290 בסניפים?" | Store-chain stock for a SKU | Live branch inventory |
| "כן" | Answer to **previous bot question** | Stay in flow |

### Layer 5 — Domain playbook

Agent-specific flows (Scenario A intake, service case types, FAQ drawers, master route definitions).
This is where **length lives** — but only after layers 1–4 anchor behavior.

### Layer 6 — Output contract

Machine JSON schema expectations. Never mixed with customer voice rules.

---

## 3. What users say vs what they mean

### 3.1 Pragmatic intent (not literal text)

Customers optimize for **speed**, not taxonomy. The bot must think at the **want** level — it cannot and should not map every Hebrew variation.

- **Got the product + any issue X** (stain, tear, smell, "לא תקין", "משהו מוזר") → Service. The specific X is a human's job.
- **"יש לי בעיה"** → could be defect (Service), policy (FAQ), or shipping (Shipping). Use thread context + next clarifier only if one essential disambiguation is needed — do not triage with a questionnaire.
- **"לא מרוצה"** after delivery → usually wants return/exchange **options** (FAQ), not immediate CS intake.
- **"לא מרוצה"** + damage words → Service.
- **"רוצה לבטל"** → policy first (FAQ) unless they already received policy and confirm execution.
- **"תודה"** alone → end conversation; **"תודה, גם רציתי לשאול..."** → handle new request.

### 3.2 Short replies are answers, not new topics

`כן`, `לא`, `1200`, `סלון`, `2 מטר`, image upload → bind to **preceding bot question**.
Master and specialists must read the last assistant turn before classifying.

### 3.3 Multi-intent priority

When one message contains multiple requests:

1. **Service** — defect, wrong/missing item, complaint, confirmed post-policy action
2. **Shipping** — live tracking of existing shipment
3. **Sales** — purchase, price, stock, design help
4. **FAQ** — general policy/info

Exception: cancellation/return/exchange/**before** policy shown → FAQ first.

### 3.4 Human request disambiguation

| Signal | Department |
|---|---|
| `נציג` + price/stock/model/design | Sales |
| `נציג` + order problem/defect/charge | Service |
| `נציג` alone | Service (default) |
| After bot offered sales handoff + `כן` | human_sales |
| After bot offered service handoff + `כן` | human_service |

---

## 4. Anti-hallucination system

### Grounding hierarchy (strict order)

1. **Explicit KB text** for this exact question
2. **Customer-provided facts** in thread (budget, space, product name they stated)
3. **Route or handoff** — if neither applies, do not answer from general knowledge

### Forbidden synthesis

- Never combine two KB facts into a new rule
- Never infer promotion/channel applicability
- Never confirm product existence, sizes, or stock without verification
- Never change policy when customer pushes back (FAQ anti-flip-flop)

### Capability boundary (all agents except FAQ on policy)

> "I don't have live access to catalog, prices, orders, or payment systems."
>
> Exception: branch inventory for a SKU (contains `-`) via `getInventoryBranch` — report per store available / not available, never quantities.

When in doubt: **offer human handoff** or **silent route** — not a plausible guess.

---

## 5. Intake discipline (Sales & Service)

### Known-facts rule

A fact is **known** if it appears anywhere in the thread (including first message).
Never re-ask: budget (`עד 1200`), space, pets, style, product type, order number if given.

### Turn budget

| Agent | Target |
|---|---|
| Sales Scenario A | Ask only missing intake fields; confirm once; then handoff offer |
| Service | ≤3 information-gathering turns; transfer even if non-essential missing |

### Image states (Sales)

`NOT_REQUESTED → REQUESTED → RECEIVED | UNAVAILABLE`

- **PENDING_UPLOAD** ("מצרפת תמונה"): wait — no questions
- **RECEIVED**: acknowledge once; stop visual questions forever in this thread
- **UNAVAILABLE**: say once, continue non-visual intake

---

## 6. Voice contract

One assistant, one header:

```
*הום בוט :)*
<message on next line, no blank line>
```

| Do | Don't |
|---|---|
| Neutral Hebrew, light warmth ("אוקיי, מובן") | Gendered singular (תרצי/תרצה/כתבי) |
| Same official facts, human wrap-up | AI fluff (איזה כיף, וואו) or emotional theater (זה מבאס) |
| One main question per turn | Stack questions; freeze on taxonomy |
| Understand the want, even in new wording | Require a table-row match |

FAQ informational replies wrap naturally (`אם צריך עוד משהו — כאן.`) — never require `כתבו "התחלה"`.

---

## 7. Handoff matrix

| Trigger | Action | Customer text |
|---|---|---|
| Store-chain stock + SKU (contains `-`) | reply with live per-store availability | Available / not — never quantities |
| Specific model/stock without SKU | human_sales offer | Required handoff script |
| Sales intake complete + confirmed | human_sales | Short confirmation |
| Service intake complete | human_service | Short "הועבר לנציג" line |
| Off-topic | reply (stay in chat) | Friendly redirect; human only if they insist |
| FAQ unknown (non-sales topic) | service offer | Exact script |
| Customer declines handoff | reply | "אין בעיה. אפשר להמשיך מכאן." |

Silent actions (`faq`, `sales`, `service`, `shipping`, `reset`, `end`) → **reply must be empty**.

---

## 8. Master router specifics

Master is **classifier only**. Its real goal: **zero customer-visible output, maximum route accuracy**.

### Policy-before-action (most common master error)

These MUST go FAQ first:

- Can I cancel / return / exchange / change address / modify order?
- Refund timing (general)
- "What if I regret?" style hypotheticals

Route Service only when:

- Policy already given AND customer confirms execution, OR
- Concrete post-purchase problem (defect, wrong item, charge error)

### Shipping vs Service vs FAQ

| Question type | Route |
|---|---|
| Where is **my** shipment now? | SHIPPING |
| How long does delivery take? | INFO |
| Change delivery address | INFO → then Service if executing |
| Product arrived damaged | SERVICE |

---

## 9. Code ↔ prompt alignment

Deterministic fast-paths in `run-agent.ts` must stay aligned with prompts:

| Code path | Prompt rule it mirrors |
|---|---|
| `guessMasterRoute` | Master route examples |
| `isFaqTopicSwitch` | FAQ policy triggers |
| `isProductAvailabilityQuestion` | PRODUCT_HANDOFF_RULE |
| `shouldUseSalesIntakeFastPath` | Sales Scenario A intake order |
| `isHumanHandoffPending` | Handoff yes/no handling |

When changing prompts, check whether code fast-paths need the same semantic update.

---

## 10. Maintenance checklist

When editing any prompt file:

- [ ] North star still accurate at top?
- [ ] Decision tree runs before domain flows?
- [ ] No duplicate rule in both `_framework.md` and agent file?
- [ ] New example added to `_intent-decoder.md` only if it teaches a new *want*, not a new synonym?
- [ ] Handoff scripts unchanged unless product requested?
- [ ] Output actions match `types.ts` `ACTIONS_BY_AGENT`?
- [ ] Shadow-review / trainer examples updated if behavior changed?

---

## 11. File map

```
lib/agents/prompts/
  _framework.md       — L3 shared behavioral contract
  _intent-decoder.md  — L4 want-not-wording guide
  master.md           — L1+L5 router playbook
  faq.md              — L1+L5 info/policy playbook
  sales.md            — L1+L5 consultation playbook
  service.md          — L1+L5 intake playbook
lib/agents/prompts.ts — assembler + output contracts
docs/agent-prompt-architecture.md — this document
```

---

## 12. Success metrics (how to know prompts improved)

Track in shadow-review / production logs:

1. **Route accuracy** — master + mid-flow switches match human label
2. **Hallucination rate** — claims about stock/policy not in KB
3. **Intake efficiency** — turns before human handoff (target: sales ≤8, service ≤3)
4. **Repeat-question rate** — bot asks for already-known facts
5. **Handoff acceptance** — customer confirms when offered
6. **Customer-visible misroute** — "wrong department" escalations

Prompt changes should be A/B tested via shadow-review before full rollout.
