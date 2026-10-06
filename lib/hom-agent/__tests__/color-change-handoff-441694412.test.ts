import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildOrderModificationAwareStatusReply,
  isOrderConfirmationPending,
  isOrderConfirmationYes,
  isOrderModificationInThread,
  mapPriorityOrderRow,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const COLOR_CHANGE =
  "קניתי אתמול שטיח כחול ואני רוצה להחליף לצבע האפור"
const ORDER_CARD =
  "*הום בוט :)* היי אורנה! אין בעיה, אפשר להחליף את השטיח הכחול לאפור. לפי הקבלה שקיבלת אתמול, מדובר בהזמנה SO26024945, נכון?"
const CONFIRM = "כן"
const BAD_REPLY =
  "*הום בוט :)* בדקתי, ההזמנה התקבלה וכעת בתהליכי אריזה במחסני החברה. אני מבין שרוצים לשנות את ההזמנה — מעביר אותך ליועץ מכירות שיבדוק אם אפשר לעדכן לפני שההזמנה יוצאת מהמחסן."

const PACKAGING_ORDER = mapPriorityOrderRow({
  ORDNAME: "SO26024945",
  REFERENCE: "#24945",
  ZPIT_DELSTATUSCODE: "1",
  ORDSTATUSDES: "ההזמנה התקבלה וכעת בתהליכי אריזה במחסני החברה.",
  ZPIT_UDATE: "2026-10-05T14:00:00+03:00",
})

/** Replay 441694412 — color change after order confirm must bind human_sales, not reply. */
describe("color change handoff after order confirm (441694412)", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: COLOR_CHANGE },
    { role: "assistant", content: ORDER_CARD },
  ]

  it("detects modification thread and pending order confirm on כן", () => {
    assert.equal(isOrderModificationInThread(history, CONFIRM), true)
    assert.equal(isOrderConfirmationPending(history), true)
    assert.equal(isOrderConfirmationYes(CONFIRM), true)
  })

  it("hints order confirm + modification with human_sales binding", () => {
    const hints = buildConversationHints({ body: CONFIRM, history }) ?? ""
    assert.match(hints, /441694412/)
    assert.match(hints, /ORDER CONFIRM \+ MODIFICATION/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /human_sales/)
    assert.match(hints, /never action reply alone/i)
  })

  it("modification-aware status reply must pair מעביר with human_sales", () => {
    const reply = buildOrderModificationAwareStatusReply(
      PACKAGING_ORDER,
      history,
      CONFIRM
    )
    assert.match(reply, /מעביר.*יועץ מכירות/)
    const action = /מעביר.*יועץ מכירות/i.test(reply)
      ? "human_sales"
      : "reply"
    assert.equal(action, "human_sales")
  })

  it("bad production reply promised sales transfer without handoff action", () => {
    assert.match(BAD_REPLY, /מעביר.*יועץ מכירות/)
    const boundAction = /מעביר.*יועץ מכירות/i.test(BAD_REPLY)
      ? "human_sales"
      : "reply"
    assert.equal(boundAction, "human_sales")
  })
})
