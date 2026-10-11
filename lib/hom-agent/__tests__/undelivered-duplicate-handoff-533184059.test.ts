import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isAwaitingReplyAfterOrderLookupAsk,
  requiresOrderIdentification,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const CUSTOMER =
  "היי, עשיתי הזמנה ב27.9, והיא עדיין לא סופקה לי.\nאודה לבדיקתכם 🙏🙏"

const BOT_ORDER_ASK =
  "*הום בוט :)*\nהיי ליאת, מבין שאת מחכה להזמנה מ-27.9 ועדיין לא הגיעה, אשמח לעזור לבדוק. יש לך מספר הזמנה? (למשל #76884 או SO26005938, מופיע במייל או ב-SMS של אישור ההזמנה) אם אין, אפשר גם לכתוב את מספר הטלפון שעליו נרשמה ההזמנה."

function historyAfterFaqOrderAsk(): HistoryMessage[] {
  return [
    { role: "user", content: "היי, אשמח לדעתי מתי יגיע אליי השטיח" },
    { role: "user", content: CUSTOMER },
    { role: "assistant", content: BOT_ORDER_ASK },
  ]
}

/** Replay 533184059 — master must not human_sales after FAQ already asked for order id. */
describe("undelivered duplicate handoff 533184059", () => {
  it("detects awaiting reply after order lookup ask on delay thread", () => {
    const history = historyAfterFaqOrderAsk()
    assert.equal(isAwaitingReplyAfterOrderLookupAsk(history), true)
    assert.equal(requiresOrderIdentification(CUSTOMER, history), true)
  })

  it("hints action end — never human_sales or off-hours sales second message", () => {
    const hints =
      buildConversationHints({
        body: CUSTOMER,
        history: historyAfterFaqOrderAsk(),
      }) ?? ""
    assert.match(hints, /533184059/)
    assert.match(hints, /action: end/i)
    assert.match(hints, /do not send human_sales/i)
    assert.match(hints, /crm_department: service/i)
  })
})
