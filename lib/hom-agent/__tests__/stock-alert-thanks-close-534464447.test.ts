import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isBackInStockSalesHandoffThread } from "@/lib/agents/inventory-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runPreTurnGuards } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

const BOT_HANDOFF =
  "*הום בוט :)*\nהיי נטע! מכאן אני לא יכול לרשום התראה על חזרה למלאי, וגם אין לי מכאן צפי להגעת המידה. אני מעביר את הפנייה ליועץ מכירות. הוא יבדוק מתי שטיח טופז קרם-ירוק במידה L (160*230) צפוי לחזור למלאי ויעדכן אתכם"

function historyBeforeThanks(): HistoryMessage[] {
  return [
    {
      role: "user",
      content:
        "היי, אשמח לקבל עדכון כשהמידה L - 160*230 של שטיח טופז קרם-ירוק TOPAZ חוזרת למלאי",
    },
    { role: "user", content: "והאם יש צפי" },
    { role: "assistant", content: BOT_HANDOFF },
  ]
}

/** Replay 534464447 — thanks after back-in-stock sales handoff must warm-close, not re-handoff. */
describe("stock alert thanks close 534464447", () => {
  it("detects back-in-stock sales handoff thread", () => {
    assert.equal(isBackInStockSalesHandoffThread(historyBeforeThanks()), true)
  })

  it("pre-turn warm-closes on thanks after executed sales handoff", () => {
    const result = runPreTurnGuards({
      turn: { text: "תודה רבהה", media: [] },
      history: historyBeforeThanks(),
      customerName: "נטע",
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "reply")
    assert.doesNotMatch(result.reply, /העברתי/)
    assert.doesNotMatch(result.reply, /מעולה/)
    assert.doesNotMatch(result.reply, /יועץ מכירות/)
  })

  it("hints warm close after back-in-stock handoff — never repeat human_sales", () => {
    const hints = buildConversationHints({
      body: "תודה רבהה",
      history: historyBeforeThanks(),
    })
    assert.match(hints ?? "", /534464447/)
    assert.match(hints ?? "", /never.*human_sales/i)
  })
})
