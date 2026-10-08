import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import {
  buildPostOrderLookupContinuationReply,
  isPostOrderShippingFollowUp,
} from "@/lib/agents/order-lookup"
import { runStructuredPostOrderCompletedPreTurn } from "@/lib/hom-agent/pre-turn"

const COURIER_QUESTION =
  "אבל בוט יקר \nמי חברת השליחויות \nהם לרוב יוצרים קשר"

function historyAfterEnRouteStatus(): HistoryMessage[] {
  return [
    { role: "user", content: "מעקב משלוח ?" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* מצאתי הזמנה שבוצעה לפני 4 ימים בבני ברק, על סך 295 ש״ח. זו ההזמנה? (מס׳ הזמנה ⁦SO26024855⁩)",
    },
    { role: "user", content: "כן" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* בדקתי, איזה כיף! המשלוח הועמס לשליח ובדרכו אליך ברגעים אלה. נכון לתאריך 08/10/2026 בשעה 13:04 שמחתי לעזור!",
    },
    {
      role: "user",
      content:
        "וואלה יש מספר שליח צפי הגעה ? קישור למעקב לא קיבלתי שום הודעה",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* משלוח שכבר הועמס לשליח אמור להגיע היום. אין לי שעה מדויקת, והשליח מתקשר לפני שהוא מגיע. אין לי מספר של השליח, כי המשלוחים יוצאים עם כמה חברות שליחויות לפי גודל המוצר. לכן גם לא נשלחה הודעה מראש, וההתקשרות תהיה ביום המסירה עצמו. זה הקישור למעקב: https://tracking.carpetshop.co.il/track?orderID=SO26024855 בכיף, המשך יום טוב",
    },
  ]
}

/** Replay 534107243 — courier-company question on en-route order must use canonical reply. */
describe("courier company en-route (534107243)", () => {
  const phone = "+972000000000"
  const history = historyAfterEnRouteStatus()

  it("detects courier metadata question after en-route status", () => {
    assert.equal(isPostOrderShippingFollowUp(COURIER_QUESTION, history), true)
    assert.equal(isPostOrderShippingFollowUp("מי חברת השליחויות", history), true)
  })

  it("returns canonical courier-unavailable reply via structured pre-turn", async () => {
    const result = await runStructuredPostOrderCompletedPreTurn({
      turn: { text: COURIER_QUESTION, media: [] },
      history,
      phone,
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "reply")
    assert.match(result.reply, /אין לי במערכת את שם חברת השליחויות/)
    assert.match(result.reply, /האם להעביר לנציג שירות/)
    assert.doesNotMatch(result.reply, /במערכת שלי לא מופיע/)
  })

  it("buildPostOrderLookupContinuationReply returns canonical template", async () => {
    const reply = await buildPostOrderLookupContinuationReply({
      body: COURIER_QUESTION,
      history,
      whatsappPhone: phone,
    })
    assert.notEqual(reply, null)
    assert.match(reply!, /אין לי במערכת את שם חברת השליחויות/)
    assert.doesNotMatch(reply!, /במערכת שלי לא מופיע/)
  })
})
