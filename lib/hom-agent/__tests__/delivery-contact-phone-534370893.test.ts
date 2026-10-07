import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import {
  isOrderLookupCompletedInThread,
  isShippingThreadFromHistory,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const CUSTOMER_ASK = "אפשר שיתקשרו רק לטלפון הנוסף?"
const STATUS_REPLY =
  "*הום בוט :)*\nבדקתי, איזה כיף! המשלוח הועמס לשליח ובדרכו אליך ברגעים אלה. נכון לתאריך 07/10/2026 בשעה 13:10 שמחתי לעזור! 😊"
const ORDER_CONFIRM =
  "*הום בוט :)*\nמצאתי הזמנה שבוצעה לפני 13 ימים בנתניה, על סך 645 ש״ח. זו ההזמנה? (מס׳ הזמנה ⁦SO26023457⁩)"

/** Replay 534370893 — delivery contact phone after in-transit status must human_service, not courier-only + להעביר? */
describe("delivery contact phone 534370893", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "הזמנו שטיח ב24/9 אמרו לנו שיגיע משלוח עד ה7/10" },
    { role: "user", content: "אשמח לברר סטטוס, כי עוד לא יצרו איתי קשר" },
    { role: "assistant", content: ORDER_CONFIRM },
    { role: "user", content: "כן" },
    { role: "assistant", content: STATUS_REPLY },
  ]

  it("detects completed shipping lookup thread", () => {
    assert.equal(isShippingThreadFromHistory(history), true)
    assert.equal(isOrderLookupCompletedInThread(history), true)
  })

  it("hints immediate human_service for delivery contact phone — not courier-only handoff offer", () => {
    const hints = buildConversationHints({ body: CUSTOMER_ASK, history }) ?? ""
    assert.match(hints, /DELIVERY CONTACT PHONE \(534370893\)/)
    assert.match(hints, /human_service/)
    assert.match(hints, /never action reply with only self-service \+ להעביר/)
  })

  it("prompt teaches delivery contact phone after shipping status", () => {
    const line = prompt.split("\n").find((l) => l.includes("534370893"))
    assert.ok(line, "missing delivery contact phone rule")
    assert.match(line!, /human_service/)
    assert.match(line!, /טלפון נוסף/)
    assert.match(line!, /Never.*action: reply.*להעביר/)
  })
})
