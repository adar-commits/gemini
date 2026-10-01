import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isExchangeIntakeActive } from "@/lib/agents/exchange-intake"
import { isOrderConfirmationPending } from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { VOICE_CLOSURE_TEMPLATE_BODY } from "@/lib/landbot/voice-closure-template"
import type { HistoryMessage } from "@/lib/agents/types"

const TRACKING_TEMPLATE =
  "שלום נוי טל, 👋 תודה על רכישתך בשטיח האדום, להלן קישור לקבלה הדיגיטלית שלך: https://documents.carpetshop.co.il/documents/33a8b1f3-45aa-49b1-a30f-b026a47f59b9 למעקב אחר התקדמות ההזמנה, יש ללחוץ כאן: https://tracking.carpetshop.co.il/track?orderID=SO26023770"

const EXCHANGE_CONFIRM =
  "*הום בוט :)*\nהיי נוי, נמשיך עם החלפה. מדובר בהזמנה SO26023770 (מהקבלה שנשלחה אליך)?"

/** 322722857 — voice-closure after exchange order confirm; כן must continue exchange quiz, not lookup/handoff. */
describe("exchange order confirm survives voice closure 322722857", () => {
  const history: HistoryMessage[] = [
    { role: "assistant", content: TRACKING_TEMPLATE },
    { role: "assistant", content: VOICE_CLOSURE_TEMPLATE_BODY },
    { role: "user", content: "החלפה" },
    { role: "assistant", content: EXCHANGE_CONFIRM },
    { role: "assistant", content: VOICE_CLOSURE_TEMPLATE_BODY },
  ]

  it("keeps exchange order confirm pending past the dashboard template", () => {
    assert.equal(isExchangeIntakeActive(history), true)
    assert.equal(isOrderConfirmationPending(history), true)
  })

  it("hints exchange kind question on כן — not voice-callback lookup or handoff", () => {
    const hints = buildConversationHints({ body: "כן", history }) ?? ""
    assert.match(hints, /EXCHANGE ORDER CONFIRM YES \(530876768\)/i)
    assert.match(hints, /A\/B\/C exchange-kind question/i)
    assert.doesNotMatch(hints, /VOICE CALLBACK TEMPLATE/)
    assert.doesNotMatch(hints, /ORDER CONFIRM YES:.*lookup_order_status immediately/i)
  })

})
