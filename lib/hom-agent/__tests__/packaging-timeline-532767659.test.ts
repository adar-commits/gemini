import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isKnownOrderConfirmPending,
  isOrderConfirmationPending,
  isShippingThreadFromHistory,
  orderIdGivenInThread,
  shouldBindKnownOrderTurn,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { VOICE_CLOSURE_TEMPLATE_BODY } from "@/lib/landbot/voice-closure-template"
import type { HistoryMessage } from "@/lib/agents/types"

const RECEIPT =
  "שלום שאדי גדבאן, 👋 תודה על רכישתך בשטיח האדום, להלן קישור לקבלה הדיגיטלית שלך: https://documents.carpetshop.co.il/documents/59c036c9-bfd5-47a2-bf8b-369192ec92ed למעקב אחר התקדמות ההזמנה, יש ללחוץ כאן: https://tracking.carpetshop.co.il/track?orderID=SO26022824"

const CONFIRM_QUESTION =
  "*הום בוט :)*\nהיי שאדי, מדובר בהזמנה SO26022824, זו שקיבלת עליה את הקבלה וקישור המעקב?"

const PACKAGING_QUESTION = "כמה זמן זה יקח עד שזה יעבור לתהליך האריזה"

/** 532767659 — packaging timeline after order confirm must lookup SO26022824, not hand off. */
describe("packaging timeline after order confirm 532767659", () => {
  const history: HistoryMessage[] = [
    { role: "assistant", content: RECEIPT },
    { role: "user", content: "מה קורה עם ההזמנה שלי" },
    { role: "assistant", content: CONFIRM_QUESTION },
    { role: "assistant", content: VOICE_CLOSURE_TEMPLATE_BODY },
  ]

  it("recognizes shipping thread from the opening order question", () => {
    assert.equal(isShippingThreadFromHistory(history), true)
  })

  it("keeps order confirm pending past voice closure", () => {
    assert.equal(orderIdGivenInThread(history), "SO26022824")
    assert.equal(isKnownOrderConfirmPending(history), true)
    assert.equal(isOrderConfirmationPending(history), true)
  })

  it("binds packaging follow-up to the known order without כן", () => {
    assert.equal(shouldBindKnownOrderTurn(PACKAGING_QUESTION, history), true)
  })

  it("hints lookup instead of human_service", () => {
    const hints = buildConversationHints({ body: PACKAGING_QUESTION, history }) ?? ""
    assert.match(hints, /KNOWN ORDER CONFIRM/)
    assert.match(hints, /SO26022824/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /Never human_service/)
    assert.match(hints, /532767659/)
    assert.match(hints, /כמה זמן עד אריזה/)
  })
})
