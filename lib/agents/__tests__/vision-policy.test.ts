import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isOrderDocumentScreenshotTurn,
  resolveVisionPolicy,
  shouldAnalyzeCustomerImage,
} from "@/lib/agents/vision-policy"
import type { HistoryMessage } from "@/lib/agents/types"

const PHOTO = "https://storage.googleapis.com/media.landbot.io/example/receipt.jpg"

describe("vision-policy — token-conscious image attach", () => {
  const salesPhotoHistory: HistoryMessage[] = [
    { role: "user", content: "שטיח לסלון" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nאפשר לשלוח תמונה אחת ברורה של החלל? זה יעזור ליועץ העיצוב.",
    },
  ]

  const orderLookupHistory: HistoryMessage[] = [
    { role: "user", content: "יש פגם בשטיח" },
    {
      role: "assistant",
      content: "*הום בוט :)*\nמבין. מה מספר ההזמנה?",
    },
  ]

  const defectHistory: HistoryMessage[] = [
    { role: "user", content: "יש חוט בקצה השטיח" },
    {
      role: "assistant",
      content: "*הום בוט :)*\nמצטער על החשש. אפשר תמונה?",
    },
  ]

  it("blocks vision for sales room photos", () => {
    const turn = {
      text: "",
      media: [{ kind: "image" as const, url: PHOTO }],
    }
    assert.equal(
      shouldAnalyzeCustomerImage({
        history: salesPhotoHistory,
        turn,
        lastAgent: "faq",
      }),
      false
    )
    assert.deepEqual(
      resolveVisionPolicy({ history: salesPhotoHistory, turn, lastAgent: "faq" }),
      { attachCurrentTurnImages: false, allowPriorImageReinject: false }
    )
  })

  it("enables vision when order number was requested and customer sends receipt screenshot", () => {
    const turn = {
      text: "",
      media: [{ kind: "image" as const, url: PHOTO }],
    }
    assert.equal(
      shouldAnalyzeCustomerImage({
        history: orderLookupHistory,
        turn,
        lastAgent: "faq",
      }),
      true
    )
  })

  it("enables vision for defect/service evidence photos", () => {
    const turn = {
      text: "",
      media: [{ kind: "image" as const, url: PHOTO }],
    }
    assert.equal(
      shouldAnalyzeCustomerImage({
        history: defectHistory,
        turn,
        lastAgent: "service",
      }),
      true
    )
  })

  it("detects order document screenshot markers in body text", () => {
    assert.equal(
      isOrderDocumentScreenshotTurn(`[תמונה][media:image:${PHOTO}]`),
      false
    )
    assert.equal(
      isOrderDocumentScreenshotTurn(
        `זו הקבלה\n[תמונה][media:image:${PHOTO}]`
      ),
      true
    )
    assert.equal(
      isOrderDocumentScreenshotTurn(
        `[תמונה][media:image:${PHOTO}]\nSO26021723`
      ),
      true
    )
  })
})
