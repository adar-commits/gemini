import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  hasOngoingSalesIntake,
  isSalesPhotoRequestPending,
  shouldAckSalesRoomPhotoWithoutVision,
} from "@/lib/agents/sales-intake"
import { runStructuredSalesPhotoPreTurn } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

const MEDIA = "https://storage.googleapis.com/media.landbot.io/256062/customers/532393809"

describe("wrong item delivered — service photo request is not sales (532642818)", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "בוקר טוב קיבלתי אתמול את המשלוח של השטיח" },
    { role: "user", content: "זה לא השטיח שהזמנתי" },
    {
      role: "user",
      content: `זה מה שהוזמן [תמונה: זה מה שהוזמן][media:image:${MEDIA}/X0QWG97WA8FP72CDSKGVW0X6XRN0GBW4.jpg]`,
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nבוקר טוב שיר, מצטער לשמוע שהגיע שטיח שונה ממה שהוזמן. קיבלתי את התמונה של השטיח שהזמנתם בהזמנה 76079. כדי שנציג השירות יוכל לבדוק ולטפל מהר, אפשר לשלוח תמונה אחת ברורה של השטיח שהגיע בפועל? אם יש מדבקה עם פרטי המוצר על השטיח או על האריזה, כדאי לצלם גם אותה.",
    },
  ]

  const photosTurn = {
    text: "",
    media: [
      { kind: "image" as const, url: `${MEDIA}/B7UBFYJURECCOJ8VKR397DIOFRA4YF3K.jpg` },
      { kind: "image" as const, url: `${MEDIA}/6ZZAZ23I13DNWPN6B2SM8JLZ3QXGK508.jpg` },
      { kind: "image" as const, url: `${MEDIA}/RPMM4OUA2U7D91OBIBSPO8SZ947Q6JMK.jpg` },
    ],
  }

  it("does not treat the service rep photo request as a sales room photo", () => {
    assert.equal(isSalesPhotoRequestPending(history), false)
    assert.equal(hasOngoingSalesIntake(history), false)
    assert.equal(shouldAckSalesRoomPhotoWithoutVision(history, photosTurn, "faq"), false)
  })

  it("skips the sales photo pre-turn so no room question is sent", () => {
    const result = runStructuredSalesPhotoPreTurn({
      turn: photosTurn,
      history,
      lastAgent: "faq",
    })
    assert.equal(result.kind, "skip")
  })

  it("still binds a real sales room photo request", () => {
    const salesHistory: HistoryMessage[] = [
      { role: "user", content: "שטיח לסלון" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nאפשר לשלוח תמונה אחת ברורה של החלל? זה יעזור ליועץ העיצוב.",
      },
    ]
    assert.equal(isSalesPhotoRequestPending(salesHistory), true)
  })
})
