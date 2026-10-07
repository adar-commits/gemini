import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import {
  hasSalesIntakeSpaceCaptured,
  isSalesCustomerPhotoOfferRequest,
  isSalesRoomPhotoAwaitingAttachment,
} from "@/lib/agents/sales-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

afterEach(() => {
  delete process.env.SALES_INTAKE_MODE
})

/** Replay 534344486 — room already סלון; customer offered photo; bot re-asked room then pets. */
describe("sales photo offer room 534344486", () => {
  const historyBeforePhotoOffer: HistoryMessage[] = [
    { role: "user", content: "היי" },
    { role: "user", content: "האם יש לכם שטיחים 4×4?" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* היי כרמית! מידה מרובעת של 4×4 יש רק בחלק מהדגמים, ויועץ המכירות יבדוק אילו דגמים קיימים בגודל הזה. כדי שהוא יוכל להציע לך משהו מתאים, לאיזה חדר השטיח מיועד?",
    },
    { role: "user", content: "סלון" },
    { role: "user", content: "צבע אבן, קרם" },
    { role: "user", content: "בהיר" },
    { role: "user", content: "גם 4×3.5 טוב" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* תודה, רשמתי: גוונים בהירים של אבן וקרם, ב-4×4 או ב-4×3.5. באיזה חדר השטיח יהיה? סלון, חדר שינה או חדר אחר?",
    },
  ]

  const photoOfferBody = "יכולה לשלוח תמונה שתעזרו לי לבחור?\nסלון"

  const badReply =
    "*הום בוט :)*\nבטח, אפשר לשלוח תמונה אחת ברורה של הסלון. זה יעזור ליועץ העיצוב לבחור איתך.\n\nבינתיים, השטיח צריך להתאים גם לבעלי חיים?"

  it("detects customer photo offer wording", () => {
    assert.equal(isSalesCustomerPhotoOfferRequest(photoOfferBody), true)
    assert.equal(isSalesCustomerPhotoOfferRequest("סלון"), false)
  })

  it("knows space was already captured before re-ask", () => {
    assert.equal(hasSalesIntakeSpaceCaptured(historyBeforePhotoOffer, photoOfferBody), true)
  })

  it("detects room photo awaiting attachment on photo offer turn", () => {
    assert.equal(
      isSalesRoomPhotoAwaitingAttachment(historyBeforePhotoOffer, photoOfferBody),
      true
    )
  })

  it("emits space captured and photo offer hints on photo offer turn", () => {
    process.env.SALES_INTAKE_MODE = "llm"
    const hints = buildConversationHints({
      body: photoOfferBody,
      history: historyBeforePhotoOffer,
      whatsappPhone: "+972547495083",
    })
    assert.match(hints ?? "", /SALES INTAKE SPACE CAPTURED \(534344486\)/i)
    assert.match(hints ?? "", /SALES PHOTO OFFER PENDING \(534344486\)/i)
    assert.match(hints ?? "", /never.*בעלי חיים/i)
  })

  it("wrong reply re-asked room and combined photo invite with pets", () => {
    assert.match(badReply, /בעלי חיים/)
    assert.doesNotMatch(
      historyBeforePhotoOffer[historyBeforePhotoOffer.length - 1]!.content,
      /סלון.*סלון/
    )
    const priorBot = historyBeforePhotoOffer.at(-1)!.content
    assert.match(priorBot, /באיזה חדר/)
  })
})
