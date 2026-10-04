import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import { runPreTurnGuards } from "@/lib/hom-agent/pre-turn"

describe("432511314 inactivity still-here on second ping", () => {
  const historyAfterSecondPing: HistoryMessage[] = [
    {
      role: "assistant",
      content: "*הום בוט :)*\nMaayan Gil, עדיין כאן?",
      agent: "master",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nמעולה Maayan Gil, אני כאן. איך אוכל להמשיך לעזור?",
      agent: "faq",
    },
    {
      role: "assistant",
      content: "*הום בוט :)*\nMaayan Gil, עדיין כאן?",
      agent: "master",
    },
  ]

  it("acks presence instead of human_service after repeat ping", () => {
    const result = runPreTurnGuards({
      turn: { text: "כן", media: [] },
      history: historyAfterSecondPing,
      customerName: "Maayan Gil",
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "reply")
    assert.match(result.reply, /איך אוכל להמשיך לעזור/)
    assert.doesNotMatch(result.reply, /נציג שירות/)
  })
})
