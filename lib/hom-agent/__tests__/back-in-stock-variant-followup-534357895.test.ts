import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import {
  isBackInStockSalesHandoffThread,
  isBackInStockVariantFollowUp,
} from "@/lib/agents/inventory-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"

const OPENING =
  "היי, אשמח לקבל עדכון כשהמידה M - 140*190 של שטיח סיטאר 01 קרם SITAR חוזרת למלאי"

const HANDOFF_REPLY =
  "*הום בוט :)*\nהיי ניצן! מכאן בצ'אט אין לי אפשרות לרשום התראה על חזרה למלאי. אז אני מעביר את הבקשה ליועץ מכירות: הוא יבדוק מתי סיטאר 01 קרם במידה M (140*190) צפוי לחזור למלאי, ויעדכן אותך."

const FOLLOW_UP = "תודה גם על הקרם בז׳ אשמח לדעת"

const WRONG_REPLY =
  "*הום בוט :)*\nמעולה, העברתי את השיחה ליועץ מכירות. ניצור קשר בהקדם."

function historyBeforeFollowUp(): HistoryMessage[] {
  return [
    { role: "user", content: OPENING },
    { role: "assistant", content: HANDOFF_REPLY },
    { role: "assistant", content: "היי אבדוק אם נשאר" },
  ]
}

/** Replay 534357895 — variant follow-up after back-in-stock sales handoff must not re-transfer. */
describe("back-in-stock variant follow-up 534357895", () => {
  it("detects back-in-stock sales handoff thread", () => {
    assert.equal(isBackInStockSalesHandoffThread(historyBeforeFollowUp()), true)
  })

  it("detects variant follow-up turn", () => {
    assert.equal(
      isBackInStockVariantFollowUp(FOLLOW_UP, historyBeforeFollowUp()),
      true
    )
  })

  it("hints reply recap — never repeat handoff prose", () => {
    const hints = buildConversationHints({
      body: FOLLOW_UP,
      history: historyBeforeFollowUp(),
    })
    assert.match(hints ?? "", /534357895/)
    assert.match(hints ?? "", /action: reply/i)
    assert.match(hints ?? "", /never.*העברתי/i)
  })

  it("wrong pivot reply pattern is absent from expected playbook", () => {
    assert.match(WRONG_REPLY, /העברתי/)
    assert.doesNotMatch(WRONG_REPLY, /רשמתי גם/)
  })
})
