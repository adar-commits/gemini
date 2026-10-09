import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isServiceHandoffSummaryPending,
  isServiceHandoffSummaryRepeatRefinement,
} from "@/lib/agents/service-intake"
import { runPreTurnGuards } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

const SUMMARY_1 = `*הום בוט :)*
מבין, דיאנה, עבר כבר יותר משבוע ואת מחכה לשטיח החלופי.
• הלקוחה מחכה לשטיח החלופי שנשלח בעקבות פגמים בשטיח שהגיע
• טלפון: 054-2451047
זה מדויק, או שחסר משהו?`

const SUMMARY_2 = `*הום בוט :)*
תודה שעדכנת, דיאנה. הוספתי את זה לסיכום:
• דיווח על בעיה / חשש (לפי הלקוחה): התפר בצדי השטיח נראה שונה מהתמונות באתר, והיה גם פגם בלולאות
• טלפון: 054-2451047
עכשיו זה מדויק?`

const CUSTOMER_CS_PROMISE =
  "בשירות הלקוחות לפני יותר משבוע נאמר שהשטיח החלופי יגיע תוך כמה ימים"

function historyThroughSecondSummary(): HistoryMessage[] {
  return [
    {
      role: "user",
      content:
        "אודה לעדכון לכבי אספקה עבר כבר מעל שבוע… ומדובר באפקת שטיח חלופי עקב פגמים",
    },
    { role: "assistant", content: SUMMARY_1, awaiting: "service_summary_confirm" },
    { role: "user", content: "היה גם פגם בלולאות" },
    { role: "assistant", content: SUMMARY_2, awaiting: "service_summary_confirm" },
  ]
}

/** Replay 533162865 — third recap after two summaries must pre-turn to human_service. */
describe("replacement carpet repeat refinement (533162865)", () => {
  it("detects repeat refinement after two service recaps", () => {
    const history = historyThroughSecondSummary()
    assert.equal(isServiceHandoffSummaryPending(history), true)
    assert.equal(
      isServiceHandoffSummaryRepeatRefinement(CUSTOMER_CS_PROMISE, history),
      true
    )
  })

  it("pre-turn binds human_service instead of another מדויק recap", () => {
    const result = runPreTurnGuards({
      history: historyThroughSecondSummary(),
      turn: { text: CUSTOMER_CS_PROMISE, media: [] },
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "human_service")
    assert.doesNotMatch(result.reply, /מדויק\?/)
  })
})
