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

const MEDIA =
  "https://storage.googleapis.com/media.landbot.io/256062/customers/533910629/OZ5SYBFWXQRA133EQ4VBJTSKT2GBLKTM.jpg"

const BAD_REPLY =
  "תודה, קיבלתי את התמונה — אעביר ליועץ העיצוב. לאיזה חלל מיועד המוצר? סלון, חדר שינה, או כל חלל אחר"

function historyThroughLabelPhotoAsk(): HistoryMessage[] {
  return [
    { role: "user", content: "היי" },
    {
      role: "assistant",
      content: "*הום בוט :)* היי ואדים! 😊 במה אפשר לעזור?",
    },
    { role: "user", content: "קיבלתי הזמנה לא שלי" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* מצטער על זה, ואדים — נטפל בזה. אפשר לשלוח תמונה אחת ברורה של המדבקה על החבילה? ואם יש לך את מספר ההזמנה שלך (למשל #36805), שלח גם אותו, כדי שנבין מה הגיע ומה היה אמור להגיע.",
    },
  ]
}

const photoBody = `[media:image:${MEDIA}]`

/** Replay 534161594 — label photo after misdelivery report must not pivot to sales room question. */
describe("misdelivered package label photo (534161594)", () => {
  it("detects label-on-package photo request as service evidence, not sales", () => {
    const history = historyThroughLabelPhotoAsk()
    assert.equal(isServiceEvidencePhotoRequestPending(history), true)
    assert.equal(isSalesPhotoRequestPending(history), false)
    assert.equal(isServicePhotoAnalysisContext(history, photoBody), true)
  })

  it("skips sales photo pre-turn for photo-only label reply", () => {
    const history = historyThroughLabelPhotoAsk()
    const turn = {
      text: "",
      media: [{ kind: "image" as const, url: MEDIA }],
    }
    assert.equal(shouldAckSalesRoomPhotoWithoutVision(history, turn, "faq"), false)
    const result = runStructuredSalesPhotoPreTurn({
      turn,
      history,
      lastAgent: "faq",
    })
    assert.equal(result.kind, "skip")
  })

  it("emits service label photo hint, not sales room photo", () => {
    const hints =
      buildConversationHints({
        history: historyThroughLabelPhotoAsk(),
        body: photoBody,
      }) ?? ""
    assert.match(hints, /534161594/)
    assert.match(hints, /SERVICE DEFECT \/ LABEL PHOTO/)
    assert.doesNotMatch(hints, /SALES ROOM PHOTO/)
    assert.doesNotMatch(hints, /PHOTO RECEIVED \(533695023/)
  })

  it("the bad reply pivoted to sales room intake", () => {
    assert.match(BAD_REPLY, /לאיזה חלל/)
    assert.match(BAD_REPLY, /יועץ העיצוב/)
  })
})
