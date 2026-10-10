import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isOrderConfirmationPending,
  isOrderConfirmationYes,
  pendingOrderNumberFromHistory,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const OPENING = "הובטח תאריך הגעה ארצה ב9.10 ."
const ETA_ASK = "מהו תאריך האספקה ?"
const MERGED_ETA_CONFIRM = `${ETA_ASK}\nכן`
const BOT_CARD =
  "*הום בוט :)*\nמצאתי הזמנה שבוצעה לפני 50 ימים בראשון לציון, על סך 2,400 ש״ח. זו ההזמנה? (מס׳ הזמנה SO26019943)"
const BAD_REPLY =
  "*הום בוט :)*\nכרגע אין לי אפשרות להציג כאן את תאריך האספקה המעודכן של הזמנה SO26019943."

/** Replay 529935551 — merged ETA ask + כן after order card must lookup, not human_service. */
describe("promised eta confirm 529935551", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: OPENING },
    { role: "assistant", content: "*הום בוט :)* אני על זה, כמה רגעים בבקשה 🙏" },
    { role: "user", content: ETA_ASK },
    { role: "assistant", content: BOT_CARD },
  ]

  it("pending order card with merged ETA ask + trailing כן", () => {
    assert.equal(isOrderConfirmationPending(history), true)
    assert.equal(isOrderConfirmationYes(MERGED_ETA_CONFIRM), false)
    assert.equal(pendingOrderNumberFromHistory(history), "SO26019943")
  })

  it("hints lookup_order_status — not cannot-show-date handoff", () => {
    const hints = buildConversationHints({ body: MERGED_ETA_CONFIRM, history }) ?? ""
    assert.match(hints, /529935551|SHIPPING ORDER CONFIRM YES/)
    assert.match(hints, /lookup_order_status/)
    assert.doesNotMatch(hints, /ORDER CONFIRM NO ISSUE STATED/)
  })

  it("bad reply skipped lookup and handed off", () => {
    assert.match(BAD_REPLY, /אין לי אפשרות להציג/)
    assert.doesNotMatch(BAD_REPLY, /בדקתי/)
  })
})
