import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildSalesPhotoReceivedTurnResult,
  isSalesSizingPhotoSubstitutePending,
} from "@/lib/agents/sales-intake"
import type { HistoryMessage } from "@/lib/agents/types"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runStructuredSalesPhotoPreTurn } from "@/lib/hom-agent/pre-turn"

/** 534254797 — round rug FAQ: customer chose photo instead of sofa dimensions; bot said אעביר but stayed reply. */
describe("sales sizing photo substitute 534254797", () => {
  const photoUrl =
    "https://storage.googleapis.com/media.landbot.io/256062/customers/534003661/NAJQ7KBH7JDNFI5NCS31XQYJWFFNEJZ8.jpg"

  const history: HistoryMessage[] = [
    { role: "user", content: "היי מה נשמע?" },
    {
      role: "user",
      content: "רציתי לדעת מה הגודל הכי גדול של שטיח עגול שיש לכם?",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* היי ליאור, הכל טוב! המידות של שטיחים עגולים משתנות מדגם לדגם, ויועץ מכירות יבדוק מה הקוטר הכי גדול שיש כרגע. כדי שיוכל לבדוק בשבילך, לאיזה חדר השטיח מיועד?",
    },
    { role: "user", content: "לסלון" },
    { role: "user", content: "תודה" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* בכיף כדי שהיועץ יוכל להתאים את השטיח, מה בערך גודל הסלון או הספה? (למשל ספה 2.5 מ׳ או חדר 4×5 מ׳)",
    },
    { role: "user", content: "אפשר פשוט להעלות תמונה?" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* בטח, אפשר לשלוח תמונה אחת ברורה של הסלון. זה יעזור ליועץ להבין את החלל.",
    },
  ]

  const photoBody = `[תמונה][media:image:${photoUrl}]`
  const photoTurn = {
    text: photoBody,
    media: [{ kind: "image" as const, url: photoUrl }],
  }

  const badReply =
    "*הום בוט :)*\nתודה, קיבלתי את התמונה — אעביר ליועץ העיצוב. מה מידת הספה או הגודל הכללי של הסלון?"

  it("detects sizing photo substitute pending before the photo turn", () => {
    assert.equal(isSalesSizingPhotoSubstitutePending(history), true)
  })

  it("assigns human_sales when room photo arrives as sizing substitute", () => {
    const result = buildSalesPhotoReceivedTurnResult(history, photoBody, photoTurn)
    assert.equal(result.action, "human_sales")
    assert.match(result.reply, /קיבלתי/)
    assert.doesNotMatch(result.reply, /מה מידת הספה/)
  })

  it("pre-turn hands off deterministically on photo turn", () => {
    const result = runStructuredSalesPhotoPreTurn({
      turn: photoTurn,
      history,
      lastAgent: "faq",
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "human_sales")
    assert.doesNotMatch(result.reply, /מה מידת הספה/)
  })

  it("hints bind photo substitute to human_sales", () => {
    const hints = buildConversationHints({
      history,
      body: photoBody,
      whatsappPhone: "+972500000000",
    })
    assert.notEqual(hints, null)
    assert.match(hints!, /SALES SIZING PHOTO SUBSTITUTE \(534254797\)/)
    assert.match(hints!, /human_sales/)
    assert.doesNotMatch(hints!, /SALES ROOM PHOTO:/)
  })

  it("wrong reply pattern re-asks sofa size after transfer wording", () => {
    assert.match(badReply, /אעביר ליועץ/)
    assert.match(badReply, /מה מידת הספה/)
  })
})
