import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildSalesPhotoReceivedTurnResult } from "@/lib/agents/sales-intake"
import type { HistoryMessage } from "@/lib/agents/types"

/** 534848710 — pouf color restock photo mid sales: ack must not promise יועץ העיצוב or אעביר before handoff. */
describe("sales back-in-stock photo ack 534848710", () => {
  const history: HistoryMessage[] = [
    {
      role: "user",
      content:
        "היי, אשמח לשמוע פרטים נוספים על פוף ריביירה סאנפוף ארוך אפור בהיר SUNPOUf",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* היי שרה! סאנפוף ארוך מקולקציית ריביירה… לאיזה חלל את מתכננת אותו?",
    },
  ]

  const photoBody =
    "מתי יחזור הצבע הזה? [media:image:https://storage.googleapis.com/media.landbot.io/256062/customers/534596481/ZV5C39QYJAON5VTKLPP6U8T8Z37P908X.jpg]"

  const photoTurn = {
    text: photoBody,
    media: [
      {
        kind: "image" as const,
        url: "https://storage.googleapis.com/media.landbot.io/256062/customers/534596481/ZV5C39QYJAON5VTKLPP6U8T8Z37P908X.jpg",
      },
    ],
  }

  it("structured photo ack continues intake without design-advisor transfer wording", () => {
    const result = buildSalesPhotoReceivedTurnResult(history, photoBody, photoTurn)
    assert.equal(result.action, "reply")
    assert.match(result.reply, /קיבלתי את התמונה/)
    assert.match(result.reply, /דרישות מיוחדות/)
    assert.doesNotMatch(result.reply, /יועץ העיצוב|יועץ עיצוב/)
    assert.doesNotMatch(result.reply, /אעביר|מעביר/)
  })
})
