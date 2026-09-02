import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { shouldSkipInactivityClose } from "@/lib/agents/inactivity-policy"
import type { HistoryMessage } from "@/lib/agents/types"

describe("inactivity close policy", () => {
  it("skips auto-close during sales intake", () => {
    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content: "לאיזה חלל מיועד השטיח? (סלון, חדר שינה, חדר ילדים וכו')",
        agent: "sales",
      },
    ]
    assert.equal(shouldSkipInactivityClose(history, "sales"), true)
  })

  it("skips auto-close during inventory lookup thread", () => {
    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nבדקתי זמינות — *יש במלאי* בסניף קריית אתא (מק\"ט 31503138-200290).",
        agent: "sales",
      },
    ]
    assert.equal(shouldSkipInactivityClose(history, "sales"), true)
  })

  it("allows auto-close on generic service question", () => {
    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content: "*הום בוט :)*\nמה מספר ההזamנה שלכם?",
        agent: "service",
      },
    ]
    assert.equal(shouldSkipInactivityClose(history, "service"), false)
  })
})
