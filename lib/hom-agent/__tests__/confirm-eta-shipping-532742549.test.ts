import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isOrderConfirmationPending,
  isOrderConfirmationYes,
  isOrderDeliveryStatusQuestion,
  isServiceOrderIdentificationFlow,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const OPENING = "ישנה הזמנה נוספת"
const BOT_CARD =
  "*הום בוט :)* מצאתי הזמנה שבוצעה לפני 16 ימים באתר אינטרנט, על סך 967.5 ש״ח. זו ההזמנה? (מס׳ הזמנה ⁦77145⁩)"
const CONFIRM_ETA = "כן עוד לא הגיע אלי מה צפי ההגעה?"
const BAD_REPLY =
  "*הום בוט :)* בדקתי, ההזמנה התקבלה וכעת בתהליכי אריזה במחסני החברה. אני מבין שרוצים לשנות את ההזמנה — מעביר אותך ליועץ מכירות שיבדוק אם אפשר לעדכן לפני שההזמנה יוצאת מהמחסן."

/** 532742549 — confirm + ETA must lookup shipping, not sales handoff with action=reply. */
describe("order confirm with ETA 532742549", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: OPENING },
    { role: "assistant", content: BOT_CARD },
  ]

  it("binds כן + ETA as order confirmation", () => {
    assert.equal(isOrderConfirmationPending(history), true)
    assert.equal(isOrderConfirmationYes(CONFIRM_ETA), true)
    assert.equal(isOrderDeliveryStatusQuestion(CONFIRM_ETA), true)
  })

  it("does not treat shipping-only thread as service order identification", () => {
    assert.equal(isServiceOrderIdentificationFlow(history, CONFIRM_ETA), false)
  })

  it("hints lookup_order_status, not sales handoff", () => {
    const hints = buildConversationHints({ body: CONFIRM_ETA, history }) ?? ""
    assert.match(hints, /532742549|532732459/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /Never infer order modification/)
    assert.doesNotMatch(hints, /SERVICE ORDER ID/)
  })

  it("bad reply wrongly offered sales transfer without handoff action", () => {
    assert.match(BAD_REPLY, /מעביר.*יועץ מכירות/)
    assert.match(BAD_REPLY, /לשנות את ההזמנה/)
  })
})
