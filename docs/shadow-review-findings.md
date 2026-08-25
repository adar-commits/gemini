# Shadow Review Findings — 2026-08-25 (full backlog)

Full audit of **all 715 unreviewed shadow drafts** in Landbot Supabase (`hom_agent_shadow_logs`), plus **63** already reviewed. Window: **Aug 24 06:12 → Aug 25 20:44 UTC** (~202 conversations, ~201 phones).

> Shadow logs have `replied=false` — customers on the shadow allowlist did **not** receive these drafts. They show what the bot **would** have sent.

Automated AI review pipeline remains underused: only **63/778** logs reviewed (51 ok · 12 issue). **715 pending.**

---

## Executive summary

| Verdict | Count | % of pending |
|---|---:|---:|
| **Heuristic OK** (no material issue detected) | 640 | 89% |
| **Heuristic issue** (at least one flag) | ~75 | 11% |
| Overlap: multiple flags on same log | — | — |

**Post-deploy (after ~20:00 UTC Aug 25):** 12 new shadow logs — **0 empty shipping**, CS opener routing correct on 5/5 CS messages. Fixes are working on new traffic; backlog is mostly **pre-fix** drafts.

---

## Backlog stats

| Metric | Value |
|---|---|
| Total shadow logs | 778 |
| Reviewed (automated + deterministic) | 63 |
| **Pending review** | **715** |
| Pending Aug 24 | 317 |
| Pending Aug 25 | 398 |
| Flagged issues (reviewed only) | 12 |
| Unique conversations (pending) | 202 |
| Unique phones (pending) | 201 |

### Action mix (all pending)

| Agent | Action | Count |
|---|---|---:|
| sales | reply | 286 |
| faq | reply | 272 |
| service | human_service | 55 |
| master | shipping | 50 |
| faq | shipping | 22 |
| service | reply | 11 |
| faq | end | 10 |
| sales | human_sales | 2 |
| other | — | 17 |

### Intent mix (heuristic, pending)

| Intent | Count |
|---|---:|
| other (general / multi-topic) | 387 |
| שירות לקוחות opener | 117 |
| greeting | 115 |
| shipping status / delay | 54 |
| Landbot product details | 24 |
| complaint / refund / no answer | 14 |
| branches | 3 |
| explicit human ask | 1 |

---

## P0 — Material issues in backlog (must fix or already fixed)

### 1. Empty `shipping` action — **56 logs** (pre-fix)

Bot chose `action=shipping` with **empty** `draft_reply`. Customer gets silence.

**Examples:**
- `"מתי אני אתקבל המשלוח"` → faq/shipping, empty
- `"שירות לקוחות"` → master/shipping, empty (8 cases — see #2)
- `"?"` / `"???"` after stuck thread → master/shipping, empty

**Status:** Fixed in current deploy — order lookup + phone confirm flow; post-fix sample shows **0** empty shipping in last 12 logs.

---

### 2. `"שירות לקוחות"` → shipping (silent) — **8 logs** (pre-fix)

Same phones as Aug 24 report (972546746660, 972523300659, etc.).

**Correct:** Topic prompt — *"כיצד אוכל לעזור? יש לפרט את נושא הפנייה"*

**In backlog:** 71 CS openers now show correct topic prompt · 8 still show old shipping · 5 went to immediate human_service (mid-conversation / sticky service context — often OK)

**Status:** Fix deployed; backlog entries are historical.

---

### 3. Credit / price-match complaint → Sales intake — **2+ logs** (partially fixed)

**Example (still in backlog):**
- *"ממש מקווה שנסגור את זה , אתם לא עונים כבר מעל שבוע... התאמת מחיר"* → **sales** intake (*"לאיזה חלל מיועד השטיח?"*)

**Also OK in backlog:**
- *"לא מתאים לסלון… אשמח להחזר"* → FAQ returns policy ✓
- *"היימה אפשרויות החזרה"* → FAQ ✓

**Status:** Aug 24 service patterns help; long credit threads with prior sales sticky still leak to sales on some turns.

---

## P1 — High risk patterns

### 4. Fake stock / catalog claims — **8 logs**

Drafts say *"אבדוק במלאי"*, *"זמינות"*, or invent product facts.

Examples:
- *"ויש לכם בז' במידה הזו?"* → FAQ offers to check stock
- *"פרטים נוספים לגבי SYDNEY"* → FAQ lists sizes/price/stock options

**Status:** Product handoff + no-fake-check rules partially applied; 8 stale drafts remain.

---

### 5. Landbot `"פרטים נוספים לגבי [model]"` — **24 logs**

| Behavior | Count (approx) | Verdict |
|---|---:|---|
| Ask product URL → handoff | ~18 (recent sales) | ✓ Correct policy |
| Direct human sales offer | ~3 | ✓ Acceptable |
| FAQ hallucination / visualization | ~4 | ✗ Issue |
| Off-topic handoff | 1 | ✗ Issue |

**Good (recent):** *"אשמח לקבל קישור לדף המוצר"* or *"האם להעביר ליועץ מכירות"*

**Bad (older FAQ):** Invented product description, visualization link without handoff, generic off-topic offer.

---

### 6. Service `human_service` on non-handoff turns — **55 logs total**

Many are **correct** (complaints, order changes, no one answering).

**False-positive handoffs (~2 flagged):**
- *"תודה רבה"* / *"אוקי, אגיע"* → handoff message (sticky service mid-thread — should be `end` or ack)

**Ambiguous:** *"שירות לקוחות"* → immediate handoff when already in service thread (may be OK).

---

### 7. Dissatisfaction routing — mixed

| Message | Draft | Verdict |
|---|---|---|
| *"לא מתאים לסלון הצבע"* | Sales: *"יש בעלי חיים?"* | ✗ Should be FAQ dissatisfaction |
| *"לא מתאים לסלון… החזר"* | FAQ return policy | ✓ |
| *"לגבי הזיכוי… התראה?"* | Casual greeting (wrong) | ✗ |

---

### 8. Double `*הום בוט :)*` header — **4 logs**

Formatting bug in normalizeReply on some FAQ paths.

---

## P2 — OK / working as intended (majority)

640 pending logs pass heuristic QA with no material flag:

- **Greetings** → welcome / small talk
- **FAQ policy** → returns, shipping policy, branches
- **Sales intake** → appropriate consultation flow
- **Service handoffs** → real complaints with handoff line present
- **CS opener (71)** → topic prompt after fix
- **Closing** → `action=end` on thanks (10 logs)
- **Shipping with reply** → post-fix phone lookup path (not in empty-shipping set)

---

## Already reviewed (63 logs)

| Verdict | Count |
|---|---:|
| ok | 51 |
| issue | 12 |

All 12 issues are **unique** (no mass rate-limit noise in current reviewed set). Common themes match P0/P1 above: empty shipping, CS→shipping, wrong agent, forbidden sales question, off-topic.

---

## Operator policy validation (confirmed on backlog)

| Case | Expected | Backlog observation |
|---|---|---|
| `"שירות לקוחות"` alone | Ask topic | 71 ✓ · 8 ✗ (old) |
| Product details (Landbot) | URL → handoff | Mostly ✓ on recent |
| Delay / tracking | Phone lookup → confirm order | Fixed in deploy; 56 old empty |
| Dissatisfaction (color/fit) | FAQ returns | Mixed |
| Explicit complaint + no answer | Service handoff | ✓ |
| `"תודה"` | Ack + stop | Some service handoff leaks |

---

## Pipeline status

1. **AI review** — only 63/778 reviewed; local `.env.production.local` has placeholder DB keys (len=2), so `run-shadow-pipeline.ts` cannot drain from dev machine without real credentials.
2. **Deterministic rules** — cover empty shipping, autoresponder, forbidden sales question, missing header; should run before AI to avoid rate limits.
3. **Recommended:** Run on Vercel cron / production env with real `AGENT_SUPABASE_*` + AI gateway credits:

```bash
npx dotenv-cli -e .env.production.local -- npx tsx scripts/run-shadow-pipeline.ts
```

---

## Priority actions

| Priority | Action | Impact |
|---|---|---|
| P0 | ~~Empty shipping reply~~ | Fixed — verify on shadow allowlist |
| P0 | ~~CS opener → topic prompt~~ | Fixed — 8 stale in backlog |
| P1 | Drain 715 pending via deterministic review + batch AI | Clear queue |
| P1 | Sticky service: don't handoff on `"תודה"` / `"?"` | ~2+ logs |
| P1 | Credit thread: break sales sticky on `התאמת מחיר` / `זיכוי` | 2+ logs |
| P1 | `"לא מתאים לסלון"` without defect path → dissatisfaction FAQ | 1+ logs |
| P2 | Expand autoresponder detection (marketing broadcasts) | future |
| P2 | Fix double-header normalizeReply | 4 logs |

---

## Verification checklist (post-deploy)

Track on **new** shadow logs only (ignore pre-fix backlog):

- [ ] Zero `action=shipping` with empty draft
- [ ] `"שירות לקוחות"` → topic prompt (not shipping / not blind handoff)
- [ ] Shipping delay → phone confirm → order confirm → status
- [ ] `"פרטים נוספים לגבי"` → URL ask or sales handoff (never fake stock)
- [ ] `"תודה"` in service thread → ack/end, not handoff
- [ ] No duplicate identical outbound messages

---

*Previous report: 2026-08-24 (380 logs, 247 pending). Backlog grew with shadow traffic; fixes landed Aug 25 evening.*
