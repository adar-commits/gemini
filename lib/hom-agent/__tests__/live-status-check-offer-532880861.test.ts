import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isKnownOrderConfirmPending, orderIdGivenInThread } from "@/lib/agents/order-lookup"
import {
  isLiveStatusCheckAffirmation,
  isLiveStatusCheckOfferPending,
} from "@/lib/hom-agent/live-status-check-offer"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const BOT_GREETING =
  "*הום בוט :)* היי שני! במה אפשר לעזור היום? אם זה לגבי הזמנה 77286, אשמח לבדוק לך מה הסטטוס שלה עכשיו."
const CONFIRM = "כן"
const BAD_REPLY =
  "*הום בוט :)* מבין שאת מחכה כבר כמה ימים, שני, ומצטער שעדיין לא חזרו אלייך. כרגע אין לי כאן נתון עדכני על צפי חידוש המלאי להזמנה 77286, אז אני מעביר את הפנייה לנציג שירות שיבדוק את התאריך הצפוי ויחזור אלייך. מעולה, העברתי את השיחה לנציג שירות. ניצור קשר בהקדם."

/** 532880861 — greeting «אשמח לבדוק» + כן must lookup, not human_service. */
describe("live status check offer 532880861", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "היי" },
    { role: "assistant", content: BOT_GREETING },
  ]

  it("has order 77286 in thread from bot greeting", () => {
    assert.equal(orderIdGivenInThread(history), "77286")
  })

  it("detects live status offer — not mistaken order-card confirm", () => {
    assert.equal(isLiveStatusCheckOfferPending(history), true)
    assert.equal(isKnownOrderConfirmPending(history), false)
    assert.equal(isLiveStatusCheckAffirmation(CONFIRM), true)
  })

  it("hints lookup_order_status — not human_service before lookup", () => {
    const hints = buildConversationHints({ body: CONFIRM, history }) ?? ""
    assert.match(hints, /532880861/)
    assert.match(hints, /77286/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /LIVE STATUS CHECK OFFER YES/)
    assert.doesNotMatch(hints, /human_service on this turn/i)
  })

  it("bad reply handed off without lookup_order_status tool path", () => {
    assert.match(BAD_REPLY, /מעביר.*נציג/)
    assert.match(BAD_REPLY, /העברתי את השיחה/)
  })
})
