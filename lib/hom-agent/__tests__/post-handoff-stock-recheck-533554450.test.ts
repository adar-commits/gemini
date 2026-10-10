import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isPostHandoffStockFollowUp } from "@/lib/agents/inventory-lookup"
import { hasLiveRepReplyAfterBotHandoff, isPostHumanHandoff } from "@/lib/agents/post-handoff"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const SALES_HANDOFF =
  "*הום בוט :)*\nמעולה עומר, סיכום בשביל יועץ המכירות:\n• מוצר: שטיח מוניקה 01 בגוון חמרה\n• חלל: סלון, בערך 3×3 מ׳\n\nאני מעביר אותך עכשיו ליועץ מכירות"

const REP_STOCK =
  "יש 200*290, 240*340, 300*400"

const BAD_REPLY =
  "*הום בוט :)*\nמכאן אני לא רואה את רשימת המידות… יועץ מכירות יבדוק… רשמתי ליועץ:\n• מוצר: שטיח מוניקה 01 בגוון חמרה"

function historyThroughRepStock(): HistoryMessage[] {
  return [
    { role: "user", content: "היי אשמח לפרטים על שטיח מוניקה 01 חמרה" },
    { role: "assistant", content: SALES_HANDOFF },
    { role: "assistant", content: REP_STOCK },
    { role: "user", content: "אוקי, אז תוכלו לעדכן אותי שזה מגיע?" },
    { role: "assistant", content: "אין אצלנו מערכת שמתזכרת" },
  ]
}

const FOLLOW_UP =
  "היי, איזה מידות של השטיח הזה שדיברנו יש כרגע במלאי?"

/** Replay 533554450 — post-handoff stock question must not restart sales intake handoff. */
describe("post-handoff stock recheck 533554450", () => {
  it("detects post-handoff stock follow-up after live rep sizes", () => {
    const history = historyThroughRepStock()
    assert.equal(isPostHumanHandoff(null, history), true)
    assert.equal(hasLiveRepReplyAfterBotHandoff(history), true)
    assert.equal(isPostHandoffStockFollowUp(history, FOLLOW_UP), true)
  })

  it("bad production reply restarted intake summary for advisor", () => {
    assert.match(BAD_REPLY, /רשמתי ליועץ/)
    assert.match(BAD_REPLY, /מוניקה 01/)
  })

  it("emits stock recheck hint with lookup path, not intake human_sales", () => {
    const hints =
      buildConversationHints({
        history: historyThroughRepStock(),
        body: FOLLOW_UP,
      }) ?? ""
    assert.match(hints, /POST-HANDOFF STOCK RECHECK/)
    assert.match(hints, /lookup_inventory/)
    assert.match(hints, /Never.*sales intake/)
    assert.doesNotMatch(hints, /POST-HANDOFF NO-RESPONSE RE-ESCALATION/)
  })
})
