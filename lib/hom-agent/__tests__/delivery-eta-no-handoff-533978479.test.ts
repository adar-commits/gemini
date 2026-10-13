import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const BODY = "מועד אספקה הזמנה 78145"

const BAD_REPLY =
  "*הום בוט :)* דינה, לפי ההודעה שקיבלת, האספקה של הזמנה 78145 מתוכננת להיום, 13.10. ביום האספקה חברת השליחויות יוצרת קשר לפני ההגעה.\n\nמעולה, העברתי את השיחה לנציג שירות. ניצור קשר בהקדם."

function history533978479(): HistoryMessage[] {
  return [
    { role: "user", content: "שלום,מועד אספקה של הזמנה 78145?" },
    {
      role: "user",
      content: "מצ\"ב הזמנה כולל שינוי כתובת שגויה שחברת השליחויות הפנתה אותי לטיפולכם",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* דינה, מצטער שאת מחכה. מעולה, העברתי את השיחה לנציג שירות. ניצור קשר בהקדם.",
    },
  ]
}

/** 533978479 — pure delivery-date ask must not re-handoff after prior human_service. */
describe("delivery eta no handoff 533978479", () => {
  it("hints post-handoff ETA reply only — no duplicate human_service", () => {
    const hints =
      buildConversationHints({
        history: history533978479(),
        body: BODY,
      }) ?? ""
    assert.match(hints, /533978479/)
    assert.match(hints, /POST-HANDOFF ETA ONLY \(533978479\)/)
    assert.match(hints, /action reply/)
    assert.match(hints, /Never.*human_service/i)
  })

  it("bad reply answered ETA then transferred without rep ask", () => {
    assert.match(BAD_REPLY, /13\.10/)
    assert.match(BAD_REPLY, /העברתי/)
  })
})
