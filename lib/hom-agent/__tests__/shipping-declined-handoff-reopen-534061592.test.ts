import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { isOrderDeliveryStatusQuestion } from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const HANDOFF_OFFER =
  "*הום בוט :)* מבין, רועי. מצטער שזה מתעכב. במערכת שלנו העדכון האחרון של חברת השליחויות הוא מהיום ב־13:06, ואני לא רואה ממנה פרטים נוספים. ייתכן שהמשלוח נטען שוב על רכב החלוקה היום. אם תרצה, אעביר את זה לנציג שירות. הוא יבדוק ישירות מול חברת השליחויות מה קורה עם החבילה ומתי היא אמורה להגיע. להעביר?"

const DECLINE = "לא, אין צורך. סומך עלייך שיגיע היום תודה"

const STATUS_AFTER_DECLINE =
  "היי מה שלומך? השטיח עוד לא הגיע, תוכל בבקשה לברר מה הסטטוס?"

const BAD_REPLY =
  "*הום בוט :)* בוקר טוב רועי, מצטער שהשטיח עדיין לא הגיע. העדכון האחרון שמופיע אצלנו מחברת השליחויות הוא עדיין מ־12/10 בשעה 13:06: המשלוח הועמס לשליח ונמצא בדרך. אין אצלנו עדכון חדש יותר. כמו שאמרתי אתמול, אני מעביר את הפנייה לנציג שירות. הוא יבדוק ישירות מול חברת השליחויות מה קורה עם הזמנה #78247 ומתי היא תגיע, ויחזור אליך. מעולה, העברתי את השיחה לנציג שירות. ניצור קשר בהקדם."

/** Replay 534061592 — after declining handoff, next-day status ask must lookup, not false «כמו שאמרתי אתמול» transfer. */
describe("shipping declined handoff reopen 534061592", () => {
  const history: HistoryMessage[] = [
    {
      role: "user",
      content:
        "היי מה שלומכם? אני רואה את מעקב ההזמנה של הזמנה #78247 ראיתי שהיא נאספה ע\"י חברת המשלוחים",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* מצאתי הזמנה שבוצעה לפני 9 ימים באתר אינטרנט, על סך 334.5 ש״ח. זו ההזמנה? (מס׳ הזמנה ⁦#78247⁩)",
    },
    { role: "user", content: "כן" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* בדקתי, איזה כיף! המשלוח הועמס לשליח ובדרכו אליך ברגעים אלה. נכון לתאריך 12/10/2026 בשעה 13:06 שמחתי לעזור!",
    },
    { role: "assistant", content: HANDOFF_OFFER },
    { role: "user", content: DECLINE },
    {
      role: "assistant",
      content:
        "*הום בוט :)* בשמחה, רועי! לפי המערכת המשלוח אצל השליח, ואם הוא לא יגיע היום, אפשר לכתוב לנו כאן ונבדוק מול חברת השליחויות. שמחתי לעזור, ערב טוב",
    },
  ]

  it("detects next-day status recheck ask", () => {
    assert.equal(isOrderDeliveryStatusQuestion(STATUS_AFTER_DECLINE), true)
  })

  it("hints lookup refresh — not duplicate human_service or false yesterday transfer", () => {
    const hints = buildConversationHints({ body: STATUS_AFTER_DECLINE, history }) ?? ""
    assert.match(hints, /SHIPPING STATUS REOPEN \(534107243 \/ 534083795 \/ 534061592\)/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /NEVER human_service/)
    assert.match(hints, /534061592/)
    assert.match(hints, /כמו שאמרתי אתמול/)
    assert.match(hints, /לא, אין צורך/)
  })

  it("prompt teaches declined handoff offer on shipping thread", () => {
    const line = prompt.split("\n").find((l) => l.includes("534061592"))
    assert.ok(line, "missing 534061592 declined handoff rule")
    assert.match(line!, /lookup_order_status/)
    assert.match(line!, /כמו שאמרתי אתמול/)
  })

  it("bad reply falsely claimed prior transfer agreement", () => {
    assert.match(BAD_REPLY, /כמו שאמרתי אתמול/)
    assert.match(BAD_REPLY, /העברתי/)
    assert.doesNotMatch(BAD_REPLY, /lookup/i)
  })
})
