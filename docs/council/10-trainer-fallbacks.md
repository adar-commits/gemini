# Trainer T2 — Fallback & Recovery

## Fallback ladder (never silent)

```
1. Deterministic rule match     → scripted or tool reply
2. Sticky specialist continue   → same agent LLM
3. LLM router (temp 0.1)        → route to specialist/tool
4. LLM specialist (temp per agent)
5. LLM retry once on parse fail → same specialist
6. Template fallback            → buildConfusedFallbackReply()
7. Offer human                  → human_sales or human_service
```

## Recovery scenarios

| Failure | Customer message | Bot response |
|---------|------------------|--------------|
| n8n API empty/error | "איפה המשלוח?" | `buildApiFailureReply()` → offer Service |
| Document not found | "שלחו קבלה" | Apologize + offer Service (no retry loop v1) |
| LLM timeout/parse | any | `buildLlmFailureReply()` |
| Unknown intent after 1 clarify | gibberish | Confused fallback + handoff offer |
| Human handoff pending + new topic | switches to FAQ question | Answer new topic — don't freeze on כן/לא |
| Customer `"לא"` to handoff | | `buildHumanHandoffDeclinedReply()` — continue in scope |

## NEVER as fallback

- Empty `reply` with `shipping` action
- `"לא הצלחתי להבין את השאלה"` on first message
- Dump to human on playful greeting
- Invent plausible policy to fill gap
