import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isKnownOrderConfirmPending,
  isOrderConfirmationPending,
  orderIdGivenInThread,
  shouldBindKnownOrderTurn,
  shouldRefuseKnownOrderLookup,
} from "@/lib/agents/order-lookup"
import { isShippingStatusQuestion } from "@/lib/agents/shipping"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { VOICE_CLOSURE_TEMPLATE_BODY } from "@/lib/landbot/voice-closure-template"
import type { HistoryMessage } from "@/lib/agents/types"

const TRACKING_TEMPLATE =
  "שלום הודיה, 👋 תודה על רכישתך בשטיח האדום, להלן קישור לקבלה הדיגיטלית שלך: https://documents.carpetshop.co.il/documents/8cb086f6-d735-4430-90d6-13fe647a4022 למעקב אחר התקדמות ההזמנה, יש ללחוץ כאן: https://tracking.carpetshop.co.il/track?orderID=SO26021165"

const CONFIRM_QUESTION =
  "*הום בוט :)*\nהיי הודיה, מצטער שהחבילה עדיין לא הגיעה. מדובר בהזמנה SO26021165, זו שקיבלת עליה את הקבלה ואת קישור המעקב?"

const COMPLAINT_BODY =
  "ההזמנה שלי לא מגיעה\nאמרו שיחזרו אליי אף אחד לא חזר\nכבר עבר כמעט חודשיים מאז שהזמנתי"

/** 530810101 — shipping delay + callback complaint must lookup SO26021165, not human_service. */
describe("shipping delay known order 530810101", () => {
  const history: HistoryMessage[] = [
    { role: "assistant", content: TRACKING_TEMPLATE },
    { role: "assistant", content: CONFIRM_QUESTION },
    { role: "assistant", content: VOICE_CLOSURE_TEMPLATE_BODY },
  ]

  it("detects shipping complaint in merged body", () => {
    assert.equal(isShippingStatusQuestion(COMPLAINT_BODY), true)
  })

  it("binds complaint to known order even before it is in history", () => {
    assert.equal(orderIdGivenInThread(history), "SO26021165")
    assert.equal(isOrderConfirmationPending(history), true)
    assert.equal(isKnownOrderConfirmPending(history), true)
    assert.equal(shouldBindKnownOrderTurn(COMPLAINT_BODY, history), true)
    assert.equal(shouldRefuseKnownOrderLookup(COMPLAINT_BODY, history), false)
  })

  it("hints lookup_order_status — not human_service without lookup", () => {
    const hints = buildConversationHints({ body: COMPLAINT_BODY, history }) ?? ""
    assert.match(hints, /530810101|KNOWN ORDER CONFIRM/)
    assert.match(hints, /SO26021165/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /Never human_service/)
  })
})
