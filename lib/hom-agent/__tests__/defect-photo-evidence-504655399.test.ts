import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isSalesPhotoRequestPending,
  isServiceEvidencePhotoRequestPending,
  isServicePhotoAnalysisContext,
  shouldAckSalesRoomPhotoWithoutVision,
} from "@/lib/agents/sales-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runStructuredSalesPhotoPreTurn } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

const MEDIA = "https://storage.googleapis.com/media.landbot.io/256062/customers/504441299"

/** Replay 504655399 — defect photo after bot asked for hole evidence must not pivot to sales. */
describe("defect photo evidence (504655399)", () => {
  const history: HistoryMessage[] = [
    {
      role: "user",
      content:
        "היי, קניתי מכם פוף רביירה פופסה זוגית בינואר ויש בה כבר חור... אני לא מוצאת את הקבלה אבל יש לי אישור הזמנה מכם במייל ובאתר, מצרפת",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nהיי דנה, חבל לשמוע על החור בפוף. קיבלתי את צילום אישור ההזמנה. רואים בו את הזמנה #65825, פוף ריביירה פופסה זוגית בצבע נייבי/לבן פסים, מ-9 בינואר. זה מספיק כדי לזהות את ההזמנה, כך שלא צריך את הקבלה. אפשר לשלוח תמונה אחת ברורה של החור בפוף? ככה הנציג יוכל לבדוק ולהציע פתרון.",
    },
  ]

  const photosBody =
    "ומצרפת תמונות של החור, המוצר עוד לא בן שנה [media:image:https://storage.googleapis.com/media.landbot.io/256062/customers/504441299/OF67KTBH9MMCWBLXMORNJ4NW7CY27QIH.jpg]"

  const photosTurn = {
    text: photosBody,
    media: [
      { kind: "image" as const, url: `${MEDIA}/OF67KTBH9MMCWBLXMORNJ4NW7CY27QIH.jpg` },
    ],
  }

  it("detects service evidence photo request from assistant text", () => {
    assert.equal(isServiceEvidencePhotoRequestPending(history), true)
    assert.equal(isSalesPhotoRequestPending(history), false)
  })

  it("treats defect photo reply as service photo context, not sales room photo", () => {
    assert.equal(isServicePhotoAnalysisContext(history, photosBody), true)
    assert.equal(shouldAckSalesRoomPhotoWithoutVision(history, photosTurn, "faq"), false)
  })

  it("skips sales photo pre-turn so no design-advisor room question", () => {
    const result = runStructuredSalesPhotoPreTurn({
      turn: photosTurn,
      history,
      lastAgent: "faq",
    })
    assert.equal(result.kind, "skip")
  })

  it("emits service defect photo hint", () => {
    const hints = buildConversationHints({ history, body: photosBody }) ?? ""
    assert.match(hints, /SERVICE DEFECT PHOTO \(504655399 \/ 534098184\)/)
    assert.doesNotMatch(hints, /SALES ROOM PHOTO/)
  })
})
