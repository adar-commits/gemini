import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const PROACTIVE_INVOICE =
  "שלום לוי יהודית 👋, תודה על רכישתך בשטיח האדום, להלן קישור לחשבונית מס הדיגיטלית שלך: https://documents.carpetshop.co.il/documents/551ff52b-358e-4789-ba95-a6a3e0ed4989 נשמח לעמוד לרשותך בכל שאלה בערוצי הדיגיטל שלנו - תתחדשו ❤️"

const LANDBOT_OPENER =
  "היי 😀👋, מחלקת שירות הלקוחות שלנו פועלת ב-WhatsApp / אימייל בלבד. פונה אליך בהמשך לשיחתך הטלפונית, איך אוכל לעזור?"

const WRONG_REPLY =
  "*הום בוט :)*\nהיי דוד,\n\nכנראה שבאמת הייתה טעות במספר, ונשלחו אליך הודעות שלא נועדו לך. מצטער על הבלבול\n\nאפשר פשוט להתעלם מהן. העברתי את זה לצוות שלנו כדי שיתקנו את מספר הטלפון בהזמנה.\n\nתודה שעדכנת, המשך יום נעים"

function historyAtWrongPhoneReport(): HistoryMessage[] {
  return [
    { role: "assistant", content: PROACTIVE_INVOICE },
    { role: "assistant", content: LANDBOT_OPENER },
    {
      role: "user",
      content:
        "נראה לי קיבלתי בטעות חשבוניות שהן לא שלי\nיכול להיות הייתה טעות במספר?",
    },
  ]
}

/** 533894412 — wrong-invoice report after Landbot opener; bot wrote העברתי with action=reply. */
describe("wrong phone handoff 533894412", () => {
  it("prompt binds human_service when writing העברתי to fix wrong phone", () => {
    const rule = prompt
      .split("\n")
      .find((line) => line.includes("533894412") && line.includes("Wrong phone"))
    assert.ok(rule)
    assert.match(rule!, /human_service/i)
    assert.match(rule!, /never.*reply.*העברתי/i)
  })

  it("hints human_service after outbound invoice even when last assistant is Landbot opener", () => {
    const hints =
      buildConversationHints({
        body: "יכול להיות הייתה טעות במספר?",
        history: historyAtWrongPhoneReport(),
        whatsappPhone: "0501234567",
        customerName: "דוד",
      }) ?? ""

    assert.match(hints, /533894412/)
    assert.match(hints, /action: human_service/i)
    assert.match(hints, /never.*action: reply.*העברתי/i)
  })

  it("does not replay wrong-phone handoff hint after customer closes the thread", () => {
    const hints =
      buildConversationHints({
        body: "זה סגר את זה בגדול",
        history: [
          ...historyAtWrongPhoneReport(),
          { role: "assistant", content: WRONG_REPLY },
          { role: "user", content: "זה סגר את זה בגדול" },
        ],
        whatsappPhone: "0501234567",
      }) ?? ""

    assert.doesNotMatch(hints, /533894412/)
  })

  it("flags transfer prose without matching action on the bad reply pattern", () => {
    assert.match(WRONG_REPLY, /העברתי/)
  })
})
