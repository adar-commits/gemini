# Shadow Review Findings — 2026-08-24

Manual review of **380 shadow drafts** + **131 live WhatsApp conversations** (Landbot Supabase).

> **Note:** All shadow logs have `replied=false` — customers on the shadow allowlist did **not** receive those drafts. Live harm came from allowlisted phones in `hom_agent_messages`.

Automated shadow review is **mostly broken**: 116/133 flagged "issues" are AI gateway rate-limit failures, not real verdicts. Only **3** genuine automated reviews completed.

---

## Stats (7 days)

| Metric | Value |
|---|---|
| Shadow drafts | 380 |
| Reviewed | 133 |
| Pending review | 247 |
| Live conversations | 131 |
| Live messages | 1,095 |

**Action mix (shadow):** FAQ reply 143 · Sales reply 104 · Service human_service 54 · Master→shipping 37

---

## P0 — Confirmed live WhatsApp failures

### 1. Credit/refund complaint → Sales intake loop

**Phone:** 972556600193 · **Conversation:** 528667234

Customer wrote a long complaint about price-match credit (40% vs 50% promo), branch sent them back, no response for a week.

**Bot actually sent (live):**
- Sales consultation intro + "לאיזה חלל מיועד השטיח?"
- Repeated the same intake question **9 times** across hours, including after "תודה רבה", photos, and payment screenshots

**Root cause:** `וזיכוי` didn't match FAQ/service regex (needed `ו` prefix). Master routed to Sales; sticky sales never broke on complaint.

**Fix applied:** Service topic patterns for `לא עונים`, `התאמת מחיר`, `וזיכוי`, `מבצע.*%`. Service checked before FAQ in master fast-path.

---

### 2. "שירות לקוחות" → Shipping (silent)

**Phones:** 972546746660, 972523300659, 972505348989, 972546404056, 972507940542

Customer wrote only **"שירות לקוחות"**. Bot routed to `shipping` with empty reply.

**Correct (per operator):** Ask topic first — "כיצד אוכל לעזור? יש לפרט את נושא הפנייה"

**Fix applied:** `isCustomerServiceOpener()` fast-path → FAQ topic prompt. Shipping detector excludes this phrase. Master fast-path → INFO.

---

### 3. Stock/catalog hallucinations

Multiple drafts claim **"אבדוק במלאי/זמינות"** or invent product facts.

Examples:
- "ויש לכם בז' במידה הזו?" → FAQ offered to check stock
- "פרטים נוספים לגבי שטיח סידני SYDNEY" → FAQ offered visualization / stock check
- "בכוונה לקחתי שטיח שבמלאי" → Sales: "אצטרך לבדוק..."

**Fix applied:** Landbot "פרטים נוספים לגבי" → product handoff (unless ייעוץ in same message). Removed fake-check sales opener.

---

## P1 — Shadow-only but high risk

| Pattern | Wrong behavior | Fix |
|---|---|---|
| Complaint about delivery delay | Master→shipping | Service patterns for delay + broken promise |
| "לא מתאים לסלון הצבע" | Sales intake (pets question) | FAQ dissatisfaction (return/exchange options) |
| FAQ describes uploaded room image | Invented furniture list | Prompt: ask to specify topic, don't describe |
| WhatsApp auto-reply from other business | Personalized greeting using their business name | Needs spam/autoresponder detection (future) |
| Duplicate `*הום בוט :)*` header | Formatting bug | normalizeReply (existing) |

---

## Operator policy decisions (2026-08-24)

| Case | Correct handling |
|---|---|
| "שירות לקוחות" alone | Ask topic, then route |
| "לא מתאים לסלון" (has product) | FAQ — return/exchange options |
| "פרטים נוספים לגבי [model]" | Human sales handoff |
| "ייעוץ בבחירת שטיח" (+ model in thread) | Sales intake |

---

## What still needs work

1. **Shadow review pipeline** — rate limits block 97% of reviews; top up AI gateway or switch model
2. **Spam/autoresponder detection** — marketing broadcasts, other businesses' away messages
3. **Shipping flow** — `action=shipping` often has empty reply; needs Landbot block or status reply template
4. **Deploy + re-measure** — verify fixes on shadow allowlist before expanding `LANDBOT_REPLY_PHONES`

---

## Recommended verification

After deploy, re-run shadow pipeline and compare:

```bash
npx dotenv-cli -e .env.production.local -- npx tsx scripts/run-shadow-pipeline.ts
```

Track: `שירות לקוחות` routing, credit complaint routing, stock-check language rate.
