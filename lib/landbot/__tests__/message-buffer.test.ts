import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { mergeTurns, summarizeTurn } from "@/lib/agents/user-turn"

describe("message burst merge intent", () => {
  it("joins ordered customer lines into one agent body", () => {
    const merged = mergeTurns([
      { text: "שלום", media: [] },
      { text: "איפה ההזמנה שלי", media: [] },
      { text: "SO26021240", media: [] },
    ])

    const body = summarizeTurn(merged)
    assert.match(body, /שלום/)
    assert.match(body, /הזמנה/)
    assert.match(body, /SO26021240/)
    assert.equal(merged.text.split("\n").length, 3)
  })
})
