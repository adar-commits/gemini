import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const PHONE = "+972506351722"

const PHONE_CONFIRM =
  "*הום בוט :)*\nלא מצאתי את ההזמנה הנכונה ברשימה. קודם אמצא את ההזמנה שלכם בזריזות, האם היא רשומה על המספר ממנו אני מתכתב כרגע? (050-6351722) אם לא, אשמח לקבל אותו."

function historyThroughPhoneConfirm(): HistoryMessage[] {
  return [
    { role: "user", content: "לא" },
    { role: "user", content: "הזמנה מספר 75708" },
    { role: "assistant", content: PHONE_CONFIRM },
  ]
}

/** Replay 530164166 — packaging status + מעביר ליועץ must bind human_sales, not reply. */
describe("order modify handoff after phone confirm (530164166)", () => {
  it("hints lookup_order_status on bare כן after phone confirm ask", () => {
    const hints =
      buildConversationHints({
        body: "כן",
        history: historyThroughPhoneConfirm(),
        whatsappPhone: PHONE,
      }) ?? ""
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /530164166/)
    assert.match(hints, /human_sales/)
  })

  it("the bad reply promised sales transfer without human_sales action", () => {
    const badReply =
      "אני מבין שרוצים לשנות את ההזמנה — מעביר אותך ליועץ מכירות שיבדוק אם אפשר לעדכן לפני שההזמנה יוצאת מהמחסן."
    assert.match(badReply, /מעביר.*יועץ מכירות/)
    const boundAction = /מעביר.*יועץ מכירות/i.test(badReply)
      ? "human_sales"
      : "reply"
    assert.equal(boundAction, "human_sales")
  })
})
