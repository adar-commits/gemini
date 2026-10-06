import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { VOICE_CLOSURE_TEMPLATE_BODY } from "@/lib/landbot/voice-closure-template"
import type { HistoryMessage } from "@/lib/agents/types"

function history533886824BeforeThirdCallback(): HistoryMessage[] {
  return [
    {
      role: "user",
      content: "רוצה להחליף דגם שרכשתי עכשיו אנא התקשרו",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* בטח ליאת, הבנתי שאת רוצה להחליף לדגם אחר את מה שרכשת עכשיו. רשמתי את הבקשה לשיחה חוזרת למספר שממנו את כותבת (052-3300550).",
    },
    { role: "assistant", content: VOICE_CLOSURE_TEMPLATE_BODY },
    { role: "user", content: "בבקשה תתקשרו" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* ליאת, רשמתי שאת מבקשת שיחה טלפונית למספר 052-3300550 בנוגע להחלפת הדגם שרכשת.",
    },
    { role: "assistant", content: VOICE_CLOSURE_TEMPLATE_BODY },
    { role: "user", content: "מה יהיה???? כמה שעות עוד אתקשר אליכם כדי לעשות שינוי בהזמנה?????" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* ליאת, את צודקת. ביקשת שיחה כבר פעמיים ועדיין אף אחד לא חזר אלייך, ואני מצטער על זה. העברתי עכשיו את הפנייה לנציג שירות שזמין כרגע, כדי שיתקשר אלייך ל-052-3300550 ויחליף לך את הדגם בהזמנה.",
    },
    { role: "assistant", content: VOICE_CLOSURE_TEMPLATE_BODY },
  ]
}

/** 533886824 — repeat callback after voice-closure template must re-escalate, not tools-only. */
describe("callback repeat after voice template 533886824", () => {
  it("emits re-escalation hint and suppresses generic voice-callback tools guidance", () => {
    const hints =
      buildConversationHints({
        history: history533886824BeforeThirdCallback(),
        body: "תתקשרו בבקשה",
      }) ?? ""
    assert.match(hints, /CALLBACK REPEAT RE-ESCALATION \(533886824\)/)
    assert.match(hints, /human_service/)
    assert.doesNotMatch(hints, /Answer their request normally this turn with tools/)
  })
})
