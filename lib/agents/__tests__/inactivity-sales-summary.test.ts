import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { shouldSkipInactivityPingForSalesHandoff } from "@/lib/agents/inactivity-policy"
import { isSalesFinalSummaryPending } from "@/lib/agents/sales-intake"
import type { HistoryMessage } from "@/lib/agents/types"
import { runPreTurnGuards } from "@/lib/hom-agent/pre-turn"

const FINAL_SUMMARY = `*הום בוט :)*\nמעולה, רשמתי — קל לניקוי.\n\nאז לסיכום עבור יועץ המכירות:\n• שטיח לסלון, מידה 240×340\n• ללא בעלי חיים\n\nהאם זה נכון עד כה?`

const MID_INTAKE = `*הום בוט :)*\nאוקיי, אז לסיכום אני מחפש עבורכם שטיח לסלון בכל סגנון, ללא בעלי חיים. אני צודק?`

describe("sales summary inactivity", () => {
  it("detects final sales summary pending", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "קל לניקוי תקציב עד 1600" },
      { role: "assistant", content: FINAL_SUMMARY },
    ]
    assert.equal(isSalesFinalSummaryPending(history), true)
    assert.equal(shouldSkipInactivityPingForSalesHandoff(history, "faq"), true)
  })

  it("still pings during mid-intake אני צודק checkpoints", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "אין בע״ח" },
      { role: "assistant", content: MID_INTAKE },
    ]
    assert.equal(isSalesFinalSummaryPending(history), false)
    assert.equal(shouldSkipInactivityPingForSalesHandoff(history, "faq"), false)
  })

  it("confirms final summary with human_sales on כן", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "קל לניקוי" },
      { role: "assistant", content: FINAL_SUMMARY },
    ]
    const result = runPreTurnGuards({
      turn: { text: "כן", media: [] },
      history,
    })
    assert.equal(result.kind, "handled")
    if (result.kind === "handled") {
      assert.equal(result.action, "human_sales")
      assert.match(result.reply, /יועץ מכירות|יועצי מכירות/)
    }
  })
})
