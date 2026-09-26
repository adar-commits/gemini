import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { mergeTurns, summarizeTurn } from "@/lib/agents/user-turn"
import { turnAwaitingTextAfterMedia } from "@/lib/landbot/message-buffer"

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

  it("flags image-only bursts that may get a text caption next", () => {
    assert.equal(
      turnAwaitingTextAfterMedia({
        text: "",
        media: [{ kind: "image", url: "https://example.com/p.jpg" }],
      }),
      true
    )
    assert.equal(
      turnAwaitingTextAfterMedia({
        text: "שלא יהיה עבה",
        media: [{ kind: "image", url: "https://example.com/p.jpg" }],
      }),
      false
    )
  })
})
