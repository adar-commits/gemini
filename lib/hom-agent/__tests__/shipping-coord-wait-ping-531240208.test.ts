import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const STATUS_REPLY =
  "*הום בוט :)* בדקתי, המשלוח נמצא אצל חברת השליחויות ומתואם לאספקה."

const HANDOFF_OFFER =
  "*הום בוט :)* אין לנו אפשרות לקבוע מראש תאריך או שעה. העדכון האחרון במערכת הוא מ-15/09, וזה כבר די הרבה זמן. כדאי שנציג שירות יבדוק את המשלוח הזה ספציפית. להעביר לו את הבדיקה?"

const OFFLINE_QUEUE =
  "*הום בוט :)* כרגע אין נציגי שירות זמינים, אבל אל דאגה — קיבלנו את הפנייה. הצוות חוזר ביום ראשון מ-09:00, ניצור איתכם קשר."

const BAD_REPLY =
  "*הום בוט :)* מעביר עכשיו לנציג שירות את הפנייה על שני הפגמים בשטיח בהזמנה SO26021560 (כולל התמונות ששלחת), יחד עם בדיקת מועד האספקה שלא תואם איתך."

function history531240208(): HistoryMessage[] {
  return [
    { role: "user", content: "מה מצב ההזמנה שלי?" },
    { role: "assistant", content: STATUS_REPLY },
    { role: "user", content: "מתי האספקה לא תיאמו איתי" },
    { role: "assistant", content: HANDOFF_OFFER },
    { role: "user", content: "כן" },
    { role: "assistant", content: OFFLINE_QUEUE },
    { role: "user", content: "בוקר טוב מחכה לתשובה לגבי משלוח של שטיח חלופי" },
  ]
}

/** Replay 531240208 — wait ping after FAQ shipping-coordination handoff must not duplicate human_service or defect recap. */
describe("shipping coordination wait ping 531240208", () => {
  it("? wait ping hints reply — not duplicate handoff or defect recap", () => {
    const hints =
      buildConversationHints({
        history: history531240208(),
        body: "?",
      }) ?? ""
    assert.match(hints, /SERVICE SHIPPING STATUS WAIT PING \(274323208/)
    assert.match(hints, /531240208/)
    assert.match(hints, /action: reply/i)
    assert.match(hints, /Never.*פגמים/i)
    assert.doesNotMatch(hints, /שני הפגמים/)
  })

  it("replacement-shipment chase gets the same wait hint", () => {
    const hints =
      buildConversationHints({
        history: history531240208(),
        body: "בוקר טוב מחכה לתשובה לגבי משלוח של שטיח חלופי",
      }) ?? ""
    assert.match(hints, /531240208/)
    assert.match(hints, /שטיח חלופי/)
  })

  it("prompt teaches shipping coordination wait ping without defect recap", () => {
    const line = prompt.split("\n").find((l) => l.includes("531240208"))
    assert.ok(line)
    assert.match(line!, /פגמים/)
    assert.match(line!, /action: reply/)
  })

  it("bad reply conflated defect case with shipping wait", () => {
    assert.match(BAD_REPLY, /שני הפגמים/)
    assert.match(BAD_REPLY, /SO26021560/)
  })
})
