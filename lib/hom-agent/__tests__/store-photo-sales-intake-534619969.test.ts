import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"

/** 534619969 — Ariana sales intake: store photo ask must not pivot to optional room photo. */
describe("store photo sales intake 534619969", () => {
  const history: HistoryMessage[] = [
    {
      role: "user",
      content: "היי אשמח לפרטים נוספים לגבי שטיח אריאנה - ארזו אפור 303*207 AREZU",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* היי Heyam! בשמחה, אריאנה ארזו אפור במידה 303*207. כדי שיועץ המכירות יוכל לתת את כל הפרטים ולהתאים בדיוק, כמה שאלות קצרות: לאיזה חלל השטיח מיועד? סלון, חדר שינה או משהו אחר?",
    },
  ]

  const customerTurn =
    "לסלון, אני אהבתי אותה מאוד רק מפחדת שהצבע הוא כהה מדי.. אפשר לקבל תמונה מהחנות?"

  const badBotReply =
    "*הום בוט :)* אוקיי, קיבלתי. בשמחה — אפשר לשלוח תמונה אחת ברורה של החלל ואעביר ליועץ שיעזור להשוות בין האפשרויות. מה מידת הספה או הגודל הכללי של הסלון?"

  it("fires store-photo hint during sales intake", () => {
    const hints = buildConversationHints({
      body: customerTurn,
      history,
      whatsappPhone: "+972547495083",
    })
    assert.match(hints ?? "", /STORE PHOTO REQUEST \(534619969\)/i)
    assert.match(hints ?? "", /human_sales/i)
  })

  it("bad reply pivots to customer room photo instead of store photo handoff", () => {
    assert.match(badBotReply, /תמונה אחת ברורה של החלל/)
    assert.doesNotMatch(badBotReply, /מעביר ליועץ|human_sales/i)
  })
})
