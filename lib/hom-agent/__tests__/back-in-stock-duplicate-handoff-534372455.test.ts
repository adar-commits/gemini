import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isBackInStockAwaitingSimilarReply } from "@/lib/agents/inventory-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const OPENING =
  "היי, אשמח לקבל עדכון כשהמידה XXL - 240*330 של שטיח בוסטון 02 בז׳ BOSTON חוזרת למלאי"

const BOT_STEP1 =
  "*הום בוט :)*\nהיי טל! 😊 קיבלנו את הבקשה לעדכון כשבוסטון 02 בז׳ במידה XXL 240*330 חוזר למלאי. רשמתי אותה יחד עם השאלה על בוסטון 04. בינתיים אולי יעניין אתכם שטיח דומה במידה הזו?"

function historyAfterFaqStep1(): HistoryMessage[] {
  return [
    { role: "user", content: OPENING },
    { role: "assistant", content: BOT_STEP1 },
  ]
}

/** Replay 534372455 — master must not human_sales after FAQ already sent step 1. */
describe("back-in-stock duplicate handoff 534372455", () => {
  it("detects awaiting reply after step1 ack + similar offer", () => {
    assert.equal(isBackInStockAwaitingSimilarReply(OPENING, historyAfterFaqStep1()), true)
  })

  it("hints action end — never human_sales or off-hours second message", () => {
    const hints = buildConversationHints({
      body: OPENING,
      history: historyAfterFaqStep1(),
    })
    assert.match(hints ?? "", /534372455/)
    assert.match(hints ?? "", /action: end/i)
    assert.match(hints ?? "", /do not send human_sales/i)
    assert.doesNotMatch(hints ?? "", /SIMILAR-ITEM FLOW/)
  })
})
