# Shadow Improvement Master Script

Operational runbook for draining the **715+ unreviewed** Landbot shadow backlog and keeping routing quality high. Pair with [shadow-review-findings.md](./shadow-review-findings.md) for audit numbers.

---

## 1. One-command pipeline (production env)

Requires real `AGENT_SUPABASE_*` and optional AI gateway for residual AI review.

```bash
npx dotenv-cli -e .env.production.local -- npx tsx scripts/run-shadow-pipeline.ts
```

**Phase order:**

| Phase | Function | Cost | Purpose |
|---|---|---|---|
| A | `resetFailedShadowReviews()` | free | Clear rate-limit false positives |
| B | `runDeterministicShadowReviewBatch()` × loop | free | Drain ~90% via code rules |
| C | `runShadowReviewBatch()` × loop | AI tokens | Residual inconclusive logs |
| D | `runShadowAutofixDrain()` | free | Apply learned rules from issues |

Env knobs:

- `SHADOW_DETERMINISTIC_BATCH_SIZE` — default 500 (max 2000)
- `SHADOW_REVIEW_BATCH_SIZE` — default 10 (max 30)
- `SHADOW_REVIEW_ENABLED=0` — skip AI phase only

---

## 2. Deterministic review rules (Phase B)

Implemented in `lib/landbot/shadow-deterministic.ts` → `classifyShadowLogDeterministic()`.

### Issues flagged automatically

| Pattern | Issue type | Fix location |
|---|---|---|
| Empty `shipping` action | empty_reply, wrong_action | `resolveOrderShippingReply` |
| CS opener → shipping | wrong_action | `customer-service-opener` |
| Sales intake on shipping status | wrong_action | `shouldHandleOrderShippingFlow` |
| Sales intake on credit/complaint | route_wrong | `isServiceTopicSwitch` + sticky break |
| Dissatisfaction → sales pets quiz | route_wrong | `isDissatisfactionWithoutDefect` |
| `human_service` on תודה / `?` | handoff_early | `isConversationClosing`, `isNonSubstantiveFollowUp` |
| FAQ fake stock / catalog | policy_risk | `sanitizeFaqProductReply` |
| Forbidden "למי הסלון משמש" | wrong_action | sales intake |
| Double `*הום בוט :)*` header | tone | `normalizeReply` dedupe |
| Handoff without customer message | empty_reply | handoff templates |
| Missing bot header on reply | tone | `normalizeReply` |

### OK flagged automatically

- CS opener → topic prompt
- Shipping question with non-empty reply
- Product question → URL ask or sales handoff offer
- Service complaint → handoff with line
- Closing → `action=end`
- Greeting → welcome reply
- Dissatisfaction → FAQ return policy

### Heuristic OK (backlog drain)

`heuristicShadowOkVerdict()` marks remaining safe drafts: reply with header, handoff with line, shipping with body.

---

## 3. Routing fixes deployed (Aug 25–26)

| Fix | File(s) |
|---|---|
| Sticky break on closing / `?` / dissatisfaction | `route-intent.ts`, `run-agent.ts` |
| Credit / price-match → service (not sales quiz) | `topic-switch.ts`, `sales-intake.ts` |
| Dissatisfaction FAQ before sticky sales | `run-agent.ts` resolveSpecialist |
| Product FAQ → URL/handoff (no fake stock) | `run-agent.ts` sanitizeFaqProductReply |
| Double header dedupe | `run-agent.ts` normalizeReply |
| Punctuation-only follow-ups | `conversation-close.ts` isNonSubstantiveFollowUp |

---

## 4. Verification checklist (new shadow traffic only)

Track on logs **after deploy** — ignore pre-fix backlog issues.

- [ ] Zero `action=shipping` with empty draft
- [ ] `"שירות לקוחות"` → topic prompt
- [ ] Shipping delay → phone confirm → order confirm → status
- [ ] `"פרטים נוספים לגבי"` → URL or handoff (never fake stock)
- [ ] `"תודה"` / `"?"` in service thread → ack, not handoff
- [ ] Credit thread breaks sales sticky → service
- [ ] `"לא מתאים לסלון"` → FAQ returns (not pets quiz)
- [ ] No duplicate identical outbound messages (`reply-dedupe.ts`)

Query pending count:

```sql
SELECT COUNT(*) FROM hom_agent_shadow_logs l
LEFT JOIN hom_agent_shadow_reviews r ON r.shadow_log_id = l.id
WHERE r.id IS NULL;
```

---

## 5. Priority if new issues appear

1. **P0** — empty reply on any customer-visible action
2. **P0** — wrong agent on first meaningful turn (CS, shipping, complaint)
3. **P1** — sticky leak (sales quiz on service/credit)
4. **P1** — policy hallucination (stock, price, tracking)
5. **P2** — tone/format (header, length, double send)

For each new issue class: add deterministic rule → routing fix → re-run Phase B drain.

---

## 6. Local dev note

`.env.production.local` with placeholder Supabase keys cannot run the pipeline locally. Use Vercel production env or Supabase MCP for stats; run `run-shadow-pipeline.ts` on a machine with real credentials.

---

*Last updated: 2026-08-26 — full backlog audit + deterministic drain + routing hardening.*
