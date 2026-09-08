import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import { buildSalesIntakeReply } from "@/lib/agents/sales-intake"

function kidsRoomHistory(): HistoryMessage[] {
  return [
    { role: "user", content: "מחפש שטיח לחדר ילדים" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nלאיזה חלל מיועד השטיח? סלון, חדר שינה, או כל חלל אחר",
    },
    { role: "user", content: "חדר ילדים שלנו" },
  ]
}

describe("kids room sales intake", () => {
  it("asks children age before furniture size when space is kids room", () => {
    const reply = buildSalesIntakeReply(kidsRoomHistory(), "")
    assert.match(reply, /ילדים קטנים, גדולים/)
    assert.doesNotMatch(reply, /מידת המיטה|מידות החדר|רהיט העיקרי/)
  })
})
