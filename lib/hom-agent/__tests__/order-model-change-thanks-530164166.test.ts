import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isSalesHandoffCommittedInAssistantText } from "@/lib/agents/human-waiting"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runPreTurnGuards } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

const TRANSFER_REPLY =
  "*הום בוט :)*\nבדקתי, ההזמנה התקבלה וכעת בתהליכי אריזה במחסני החברה. אני מבין שרוצים לשנות את ההזמנה — מעביר אותך ליועץ מכירות שיבדוק אם אפשר לעדכן לפני שההזמנה יוצאת מהמחסן."

function historyThroughTransfer(): HistoryMessage[] {
  return [
    {
      role: "user",
      content: "היי, הזמנתי שטיח ואני מעוניינת להחליף דגם",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nלא מצאתי את ההזמנה הנכונה ברשימה. קודם אמצא את ההזמנה שלכם בזריזות, האם היא רשומה על המספר ממנו אני מתכתב כרגע? (050-6351722) אם לא, אשמח לקבל אותו.",
    },
    { role: "user", content: "כן" },
    { role: "assistant", content: TRANSFER_REPLY },
  ]
}

/** Replay 530164166 — model change + declarative sales transfer must not warm-close on thanks. */
describe("order model change thanks handoff 530164166", () => {
  it("detects declarative sales transfer without leading אני מעביר", () => {
    assert.equal(isSalesHandoffCommittedInAssistantText(TRANSFER_REPLY), true)
  })

  it("pre-turn assigns human_sales on thanks — never שמחתי לעזור", () => {
    const result = runPreTurnGuards({
      turn: { text: "תודה", media: [] },
      history: historyThroughTransfer(),
      customerName: "עדי",
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "human_sales")
    assert.doesNotMatch(result.reply, /שמחתי לעזור/)
    assert.doesNotMatch(result.reply, /אם תרצו שאעביר/)
    assert.match(result.reply, /יועץ מכירות|יועצי מכירות/)
  })

  it("hints forbid warm-close after modification transfer", () => {
    const hints = buildConversationHints({
      body: "תודה",
      history: historyThroughTransfer(),
      phone: "0506351722",
    })
    assert.match(hints ?? "", /530164166/)
    assert.match(hints ?? "", /human_sales/)
    assert.match(hints ?? "", /never action end/i)
  })
})
