import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import {
  buildSalesIntakeReply,
  buildSizeExchangeConfirmationSummary,
  isSizeExchangeIntakeContext,
} from "@/lib/agents/sales-intake"

function sizeExchangeHistoryThroughSpace(): HistoryMessage[] {
  return [
    { role: "user", content: "קיבלתי את השטיח ואני חושבת שהוא גדול לנו" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nמובן! אפשר להחליף לגודל אחר — האם להעביר לנציג שירות?",
    },
    { role: "user", content: "אני לא יודעת איזו מידה אני צריכה" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nלאיזה חלל השטיח מיועד – סלון, חדר שינה, או חלל אחר?",
    },
  ]
}

describe("size-exchange sales intake", () => {
  it("detects received product with size issue", () => {
    const history = sizeExchangeHistoryThroughSpace()
    assert.equal(isSizeExchangeIntakeContext(history, "לסלון"), true)
  })

  it("asks sofa size for living room — not pets or style", () => {
    const history = sizeExchangeHistoryThroughSpace()
    const reply = buildSalesIntakeReply(history, "לסלון")

    assert.match(reply, /מידת הספה/)
    assert.doesNotMatch(reply, /בעלי חיים/)
    assert.doesNotMatch(reply, /סגנון/)
  })

  it("asks furniture size for bedroom", () => {
    const history = sizeExchangeHistoryThroughSpace()
    const reply = buildSalesIntakeReply(history, "חדר שינה")

    assert.match(reply, /מידת המיטה|רהיט העיקרי/)
    assert.doesNotMatch(reply, /בעלי חיים/)
    assert.doesNotMatch(reply, /סגנון/)
  })

  it("asks for room photo after sofa size in living room", () => {
    const history: HistoryMessage[] = [
      ...sizeExchangeHistoryThroughSpace(),
      { role: "user", content: "לסלון" },
      {
        role: "assistant",
        content: "*הום בוט :)*\nמה מידת הספה או הגודל הכללי של הסלון?",
      },
    ]
    const reply = buildSalesIntakeReply(history, "3 מטר")

    assert.match(reply, /תמונה/)
    assert.doesNotMatch(reply, /בעלי חיים/)
  })

  it("builds size-focused confirmation summary", () => {
    const summary = buildSizeExchangeConfirmationSummary({
      product: "שטיח",
      targetSpace: "סלון",
      sofaSize: "3",
      roomPhotoReceived: true,
    })

    assert.match(summary, /שטיח/)
    assert.match(summary, /סלון/)
    assert.match(summary, /תמונת חלל/)
    assert.doesNotMatch(summary, /סגנון/)
  })
})
