# Trainer T7 — Inactivity ("עדיין כאן?")

**Owner: KEEP this feature in v2.**

## Flow

1. Bot sends message with a question → starts watch (`runInactivityPipeline`)
2. **3 minutes** silence → proactive ping (`INACTIVITY_PING_MS=180000`)
3. Customer replies `כן`/`פה` → ack + resume thread
4. **15 minutes** after ping, still silent → close message (chained `inactivity-watch` + cron backup) — **service / unknown flows only**; **never** on active sales or inventory threads (lead may still convert)
5. **Skip** ping/close if already `human_sales` / `human_service`

## Close scheduling (v2 fix)

Serverless cannot sleep 15 minutes in one invocation. After each ping, the app chains `/api/landbot/inactivity-watch` with `phase=close` in ~4-minute chunks until the close deadline. **`CRON_SECRET` must be set** (same as Vercel cron auth). `/api/cron/conversation-idle` remains a backup sweeper.

## Copy (v2 — neutral Hebrew)

| Event | Text |
|-------|------|
| Ping | `*הום בוט :)*` + `{name}, עדיין כאן?` or `עדיין כאן?` |
| Ack | `*הום בוט :)*` + `מעולה, אני כאן. איך אוכל להמשיך לעזור?` |
| Close | `*הום בוט :)*` + `הפנייה נסגרה עקב אי מענה, ניתן לשלוח הודעה חוזרת לפנייה חדשה` |

## Code paths (preserve)

- [`lib/agents/inactivity.ts`](../../lib/agents/inactivity.ts)
- [`lib/landbot/inactivity-watcher.ts`](../../lib/landbot/inactivity-watcher.ts)
- [`app/api/cron/conversation-idle/route.ts`](../../app/api/cron/conversation-idle/route.ts)
- [`app/api/landbot/inactivity-watch/route.ts`](../../app/api/landbot/inactivity-watch/route.ts)

## Binding rule

Inactivity assistant messages must **not** be treated as the bot's pending question for כן/לא binding.
