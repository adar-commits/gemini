import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isOrderDeliveryStatusQuestion } from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const OPENING =
  "אני מחכה כבר המון זמן לאספקה של שטיח. כבר מעל שבוע כתוב לי במעקב ההזמנה ״ההזמנה בדרך״, בבקשה עדכון אמיתי לגבי זמן הגעה"

const BAD_FAQ_END =
  "*הום בוט :)* דניאל, מבין שאתה מחכה כבר הרבה זמן, ומצטער על העיכוב. לפי העדכון האחרון במערכת, הזמנה #77066 ממתינה להפצה. אם יש משהו נוסף שאוכל לעזור בו, אני כאן."

/** Replay 532619558 — long-wait real ETA opener must not warm-close with action end after lookup. */
describe("shipping long wait real eta 532619558", () => {
  const history: HistoryMessage[] = []

  it("detects delivery frustration opener", () => {
    assert.equal(isOrderDeliveryStatusQuestion(OPENING), true)
  })

  it("hints human_service after lookup when no ETA — not action end", () => {
    const hints = buildConversationHints({
      history,
      body: OPENING,
      whatsappPhone: "+972501234567",
    })
    assert.match(hints, /LONG WAIT REAL ETA OPENING \(532619558\)/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /human_service/)
    assert.match(hints, /Never.*action: end/)
  })

  it("bad FAQ end reply is not the expected outcome", () => {
    assert.doesNotMatch(BAD_FAQ_END, /מעביר|העברתי/)
    assert.match(BAD_FAQ_END, /ממתינה להפצה/)
  })
})
