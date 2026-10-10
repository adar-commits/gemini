import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

/** 534657587 — puff/Longy sales intake: showroom ask must not hand off with invented rug+pets recap. */
describe("showroom sales intake 534657587", () => {
  const history: HistoryMessage[] = [
    {
      role: "user",
      content:
        "אני מחפש מוצר שאפשר לשבת / שכיבה קלה וחשוב ביותר תמיכה טובה לגב תחתון שיהיה קשיח מאוד",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* בשמחה! 🙂 נשמע שפוף של Pozitive יכול להתאים לך. הפופים שלנו ממולאים בתערובת של פתיתי ספוג עם מינימום קלקר, והיא נותנת תמיכה יציבה ועמידה לאורך זמן. למי שאוהב פוף מלא וקשיח יותר יש גם פוף בוסט (Boost), מילוי נוסף שמוסיף נפח. באיזה חלל הפוף אמור לעמוד? סלון, חדר שינה, חדר עבודה או מקום אחר?",
    },
    { role: "user", content: "חשבתי על הדגם של לונגי" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* בחירה טובה לונגי מגיע בהרכבה עצמית פשוטה, בלי כלים, ויש לו סרטון הדרכה משלו. על מידת הקשיחות והתמיכה לגב התחתון בלונגי, יועץ המכירות יוכל לתת לך תשובה מדויקת. רשמתי את זה בשבילו. באיזה חלל הוא אמור לעמוד? סלון, חדר שינה, חדר עבודה או מקום אחר?",
    },
    { role: "user", content: "סלון" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* מעולה, סלון אפשר לשלוח תמונה אחת ברורה של הסלון? זה יעזור ליועץ העיצוב. אם אין תמונה, אין בעיה ונמשיך.",
    },
  ]

  const customerTurn =
    "יש מקום פיזי/ אולם תצוגה שאפשר להרגיש את המוצר?"

  const badBotReply =
    "*הום בוט :)* אוקיי, אז לסיכום אני מחפש עבורכם שטיח לסלון מתאים לבעלי חיים. מעביר עכשיו ליועץ מכירות שימשיך מכאן."

  it("prompt binds showroom mid-intake to branch info + reply", () => {
    const line = prompt.split("\n").find((l) => l.includes("534657587"))
    assert.ok(line)
    assert.match(line!, /get_branch_info/i)
    assert.match(line!, /action: reply/i)
  })

  it("fires showroom hint during puff sales intake", () => {
    const hints = buildConversationHints({
      body: customerTurn,
      history,
      whatsappPhone: "+972547495083",
    })
    assert.match(hints ?? "", /SHOWROOM VISIT \(534657587\)/i)
    assert.match(hints ?? "", /get_branch_info/i)
    assert.match(hints ?? "", /action: reply/i)
    assert.match(hints ?? "", /never.*שטיח/i)
  })

  it("bad reply invented rug recap and pets", () => {
    assert.match(badBotReply, /שטיח/)
    assert.match(badBotReply, /בעלי חיים/)
    assert.doesNotMatch(badBotReply, /פוף|לונגי/i)
  })
})
