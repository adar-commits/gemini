import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildSalesPhotoReceivedTurnResult,
  isSalesSizingPhotoSubstitutePending,
} from "@/lib/agents/sales-intake"
import type { HistoryMessage } from "@/lib/agents/types"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runStructuredSalesPhotoPreTurn } from "@/lib/hom-agent/pre-turn"

/** 260010358 — Boston rug sales: bot offered photo instead of playroom size; customer sent photo then got re-asked. */
describe("sales playroom sizing photo 260010358", () => {
  const photoUrl =
    "https://storage.googleapis.com/media.landbot.io/256062/customers/259966853/GW0GS1FZRYUSVBXSFM52HPLUFXOWHUGN.jpg"

  const historyBeforePhoto: HistoryMessage[] = [
    { role: "user", content: "היי אשמח לפרטים נוספים לגבי שטיח בוסטון 02 בז׳ BOSTON" },
    { role: "user", content: "1" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* היי נועה! 😊 בשמחה, אני יכול לעזור עם בוסטון 02 בבז׳. בשביל איזה חדר את מחפשת את השטיח?",
    },
    {
      role: "user",
      content: "חדר משחקים בבית יש שני כלבים אחד מנשיר בית קרקע",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* תודה נועה, רשמתי: חדר משחקים, בית קרקע ושני כלבים, אחד מהם מנשיר חדר המשחקים מיועד לילדים? אם כן, הם קטנים, גדולים או גם וגם?",
    },
    { role: "user", content: "קטנים 3, 1" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* מעולה, רשמתי: ילדים בני 3 ו-1 מה בערך גודל חדר המשחקים? (למשל 3×3 מ׳) זה יעזור ליועץ המכירות.",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* קיבלתי, תודה נועה 🙂 מה בערך גודל חדר המשחקים? אם קשה למדוד, אפשר לשלוח במקום זה תמונה אחת ברורה של החדר.",
    },
  ]

  const photoBody = `[תמונה][media:image:${photoUrl}]`
  const photoTurn = {
    text: photoBody,
    media: [{ kind: "image" as const, url: photoUrl }],
  }

  const badReply =
    "*הום בוט :)* קיבלתי, תודה נועה 🙂 מה בערך גודל חדר המשחקים? אם קשה למדוד, אפשר לשלוח במקום זה תמונה אחת ברורה של החדר."

  it("detects sizing photo substitute when bot offered photo on playroom size ask", () => {
    assert.equal(isSalesSizingPhotoSubstitutePending(historyBeforePhoto), true)
  })

  it("assigns human_sales on photo turn instead of re-asking size", () => {
    const result = buildSalesPhotoReceivedTurnResult(historyBeforePhoto, photoBody, photoTurn)
    assert.equal(result.action, "human_sales")
    assert.match(result.reply, /קיבלתי/)
    assert.doesNotMatch(result.reply, /מה בערך גודל/)
    assert.doesNotMatch(result.reply, /במקום זה תמונה/)
  })

  it("pre-turn hands off on photo turn", () => {
    const result = runStructuredSalesPhotoPreTurn({
      turn: photoTurn,
      history: historyBeforePhoto,
      lastAgent: "faq",
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "human_sales")
  })

  it("hints bind playroom sizing photo to human_sales", () => {
    const hints = buildConversationHints({
      history: historyBeforePhoto,
      body: photoBody,
      whatsappPhone: "+972500000000",
    })
    assert.notEqual(hints, null)
    assert.match(hints!, /SALES SIZING PHOTO SUBSTITUTE/)
    assert.doesNotMatch(hints!, /SALES ROOM PHOTO: reference/)
  })

  it("wrong reply re-offers photo after customer already sent one", () => {
    assert.match(badReply, /גודל חדר המשחקים/)
    assert.match(badReply, /במקום זה תמונה/)
  })
})
