import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { extractOrderReference } from "@/lib/agents/order-lookup"
import { isShippingStatusQuestion } from "@/lib/agents/shipping"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const SUMMARY =
  "*הום בוט :)* מבין שחיכית ושזה לוקח יותר זמן, לאה. לפי המערכת ההזמנה עדיין בתהליכי אריזה במחסן, וכשזמן האספקה עובר, נציג שירות בודק את ההזמנה אישית. כדי שהנציג לא יצטרך לשאול אותך שוב, זה מה שאעביר לו: • מס׳ הזמנה: #78309 • ההזמנה בוצעה באתר לפני 6 ימים, והסטטוס עדיין באריזה במחסן • הלקוחה מבקשת לבדוק למה השטיח עוד לא הגיע, כי לדבריה זמן האספקה (עד 4 ימי עסקים) כבר עבר זה מדויק, או שחסר משהו?"

const OOO_HANDOFF =
  "*הום בוט :)* כרגע אין נציגי שירות זמינים, אבל אל דאגה — קיבלנו את הפנייה. הצוות חוזר ביום ראשון מ-09:00, ניצור איתכם קשר. [שירות] מבקשים: עיכוב משלוח #78309"

const REOPEN = "היי מה נשמע? \nיש חדש עם ההזמנה שלי?"

const BAD_REPLY =
  "*הום בוט :)* היי לאה, שבוע טוב! בבדיקה האחרונה ההזמנה #78309 עדיין הייתה בתהליכי אריזה במחסן, ואין לי עדכון חדש מעבר לזה. מבין שזה כבר מתעכב. סימנתי את הפנייה שלך כדחופה ואני מעביר אותה עכשיו לנציג שירות. מעולה, העברתי את השיחה לנציג שירות. ניצור קשר בהקדם."

/** Replay 534083795 — follow-up «יש חדש» after delay handoff must lookup, not duplicate human_service. */
describe("shipping delay reopen 534083795", () => {
  const history: HistoryMessage[] = [
    {
      role: "user",
      content:
        "אוקיי אבל עברו כבר 6 ימים, וההזמנה אמורה להגיע תוך 4 ימי עסקים",
    },
    { role: "user", content: "זה צריך להגיע כבר" },
    { role: "assistant", content: SUMMARY },
    { role: "user", content: "כן זה מעולה תודה רבה 🙏" },
    { role: "assistant", content: OOO_HANDOFF },
  ]

  it("detects shipping news follow-up and thread context", () => {
    assert.equal(isShippingStatusQuestion(REOPEN), true)
    assert.equal(extractOrderReference(SUMMARY), "78309")
    assert.match(OOO_HANDOFF, /\[שירות\]/)
  })

  it("hints lookup refresh — not duplicate human_service", () => {
    const hints = buildConversationHints({ body: REOPEN, history }) ?? ""
    assert.match(hints, /SHIPPING STATUS REOPEN \(534107243 \/ 534083795\)/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /NEVER human_service/)
    assert.match(hints, /534083795/)
  })

  it("prompt teaches shipping news after delay handoff", () => {
    const line = prompt.split("\n").find((l) => l.includes("534083795"))
    assert.ok(line, "missing 534083795 shipping delay reopen rule")
    assert.match(line!, /יש חדש/)
    assert.match(line!, /lookup_order_status/)
  })

  it("bad reply recycled stale status and re-transferred", () => {
    assert.match(BAD_REPLY, /העברתי/)
    assert.match(BAD_REPLY, /דחופ/)
    assert.doesNotMatch(BAD_REPLY, /lookup/i)
  })
})
