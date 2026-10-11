import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { isShippingStatusQuestion } from "@/lib/agents/shipping"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const REOPEN = "מעקב משלוח"

const BAD_REPLY =
  "*הום בוט :)* לפי הסטטוס האחרון, ההזמנה הועמסה לשליח ב-08/10/2026 בשעה 13:04 והיא בדרך. השליח מתקשר ביום המסירה, לפני שהוא מגיע. בשביל שם חברת השליחויות ופרטים נוספים על המשלוח, סימנתי לנציג השירות לבדוק את ההזמנה SO26024855 ולחזור עם תשובה מעולה, העברתי את השיחה לנציג שירות. ניצור קשר בהקדם."

/** Replay 534107243 — repeat מעקב משלוח after prior handoff must not auto human_service. */
describe("shipping tracking reopen 534107243", () => {
  const history: HistoryMessage[] = [
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
    { role: "user", content: "כן להעביר לנציג שירות" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* בשמחה, אני מעביר עכשיו לנציג שירות. הוא יבדוק איזו חברת שליחויות מטפלת בהזמנה SO26024855",
    },
    {
      role: "user",
      content: "היי הייתי אצלכם בסניף בני ברק ביקשתי מהמוכרת להזמין לי שטיח בצבע קרם",
    },
    {
      role: "assistant",
      content:
        "שלום טליה פורת 👋, תודה על רכישתך בשטיח האדום, להלן קישור לחשבונית מס הדיגיטלית שלך: https://documents.carpetshop.co.il/documents/9e5c43f2-c257-4493-9d61-b57b57d7eb6e",
    },
  ]

  it("classifies reopen line as shipping status", () => {
    assert.equal(isShippingStatusQuestion(REOPEN), true)
  })

  it("hints status-only reopen — not stale human_service", () => {
    const hints = buildConversationHints({ body: REOPEN, history }) ?? ""
    assert.match(hints, /SHIPPING STATUS REOPEN \(534107243/)
    assert.match(hints, /NEVER human_service/)
    assert.match(hints, /Prior-day handoff does not auto-repeat/)
    assert.match(hints, /lookup_order_status/)
  })

  it("prompt teaches shipping tracking reopen without stale handoff", () => {
    const line = prompt.split("\n").find((l) => l.includes("534107243"))
    assert.ok(line, "missing 534107243 shipping tracking reopen rule")
    assert.match(line!, /מעקב משלוח/)
    assert.match(line!, /human_service/)
  })

  it("bad reply auto-transferred on bare tracking ask", () => {
    assert.match(BAD_REPLY, /סימנתי לנציג/)
    assert.match(BAD_REPLY, /העברתי/)
  })
})
