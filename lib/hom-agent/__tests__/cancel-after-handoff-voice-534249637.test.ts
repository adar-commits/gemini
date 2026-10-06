import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  hasDeclarativeHandoffTransferInText,
  isPostHumanHandoff,
} from "@/lib/agents/post-handoff"
import { shouldBypassHumanThreadSilence } from "@/lib/agents/off-topic"
import type { HistoryMessage } from "@/lib/agents/types"
import { VOICE_CLOSURE_TEMPLATE_BODY } from "@/lib/landbot/voice-closure-template"

const PORTAL = "https://returns.carpetshop.co.il/?phone=0534446484"

function history534249637(): HistoryMessage[] {
  return [
    { role: "user", content: "היי" },
    { role: "assistant", content: "*הום בוט :)* היי פולינה! 😊 במה אפשר לעזור?" },
    { role: "user", content: "אני רוצה לבטל את ההזמנה שלי" },
    {
      role: "assistant",
      content: `*הום בוט :)* בסדר פולינה, נטפל בזה. כדי לבטל, יש לפתוח בקשת ביטול בפורטל (הטלפון שלך כבר ממולא): ${PORTAL} אם ההזמנה כבר הגיעה אלייך, אפשר לבטל תוך 14 יום מהקבלה, אם המוצר ללא שימוש ובאריזתו המקורית. בפורטל בוחרים אם להחזיר בסניף (ללא עלות) או עם שליח שיאסוף מהבית (בתשלום לפי גודל השטיח). את הכסף מחזירים עד 7 ימי עסקים מהביטול. בינתיים אני מעביר אותך לנציג שירות, כדי שיעצור את המשלוח אם ההזמנה עוד לא יצאה.`,
    },
    { role: "assistant", content: VOICE_CLOSURE_TEMPLATE_BODY },
  ]
}

/** 534249637 — after human_service + voice template, bot must stay silent on repeat cancel ask. */
describe("cancel after handoff voice template 534249637", () => {
  it("detects declarative service handoff in bot text", () => {
    assert.equal(
      hasDeclarativeHandoffTransferInText(
        "בינתיים אני מעביר אותך לנציג שירות, כדי שיעצור את המשלוח"
      ),
      true
    )
  })

  it("is post-handoff past the voice-closure template", () => {
    assert.equal(isPostHumanHandoff(null, history534249637()), true)
  })

  it("does not bypass human-thread silence on a repeat cancel message", () => {
    assert.equal(
      shouldBypassHumanThreadSilence(
        "שלום ביצעתי הזמנה ואני מעוניינת לבטל אותה",
        history534249637()
      ),
      false
    )
  })
})
