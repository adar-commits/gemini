import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const BAD_OFFLINE_HANDOFF =
  "*הום בוט :)*\nקיבלתי את התמונה 🙂\n\nלגבי ההטבה — מבצע בזק אקסטרה 10% עדיין בתוקף עד היום (11/10/2026). קוד הקופון: EX10 — מזינים בעגלת הקניות באתר. הטבה נוספת מעבר למבצעים הפעילים אני לא יכול לשחרר.\n\nלגבי האספקה — השטיח מיובא מחו״ל, ולכן אי אפשר להקדים את הצפי של 29/10. עם זאת, משלוחים כאלה מגיעים לפעמים כמה ימים מוקדם יותר.\n\nליועץ המכירות:\n• הזמנת השטיח מהתמונה במידה 240*340\n• צפי אספקה שנמסר: 29/10, שאלה על הקדמה\n• עניין בהטבת 10% (קוד EX10)\n\nכרגע אין יועצי מכירות זמינים (שעות הפעילות א'-ה' 09:30-18:00, ו' 09:00-14:00), אבל אל דאגה — קיבלנו את הפנייה וניצור איתכם קשר מיד עם חזרת הצוות לזמינות."

/** 534716649 — offline human_sales after photo + size must not show rep header or duplicate OOO. */
describe("sales offline handoff 534716649", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "היי" },
    {
      role: "assistant",
      content: "*הום בוט :)* היי! 😊 במה אפשר לעזור?",
    },
  ]

  const customerTurn =
    "אני רוצה להזמין את השטיח הזה ב2.4/3.4 אמרו שאספקה ב29.10 השאלה אם יש סיכוי שזה יוקדם ודבר שני אתמול הייתה עוד הטבה של 10% ועכשיו לא רואה, אשמח אם תשחררו עוד הטבה [media:image:https://example.com/rug.jpg]"

  it("emits photo received hint with offline customer-reply rules", () => {
    const hints = buildConversationHints({
      body: customerTurn,
      history,
      whatsappPhone: "+972500000053",
    })
    assert.match(hints ?? "", /534716649/)
    assert.match(hints ?? "", /PHOTO RECEIVED/)
    assert.match(hints ?? "", /ליועץ המכירות/i)
    assert.match(hints ?? "", /runtime appends queue notice/i)
  })

  it("prompt binds offline escalate without rep-facing headers", () => {
    assert.match(prompt, /534716649/)
    assert.match(prompt, /ליועץ המכירות:/)
    assert.match(prompt, /Never.*repeat hours/i)
  })

  it("documents wrong rep header and duplicate OOO from production", () => {
    assert.match(BAD_OFFLINE_HANDOFF, /ליועץ המכירות:/)
    assert.match(BAD_OFFLINE_HANDOFF, /אין יועצי מכירות זמינים/)
    assert.match(BAD_OFFLINE_HANDOFF, /EX10/)
  })
})
