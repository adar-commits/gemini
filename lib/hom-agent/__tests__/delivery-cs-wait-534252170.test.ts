import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  extractOrderReference,
  isOrderDeliveryStatusQuestion,
  requiresOrderIdentification,
} from "@/lib/agents/order-lookup"
import { isShippingStatusQuestion } from "@/lib/agents/shipping"
import { isDeliverySupplyInquiry } from "@/lib/hom-agent/delivery-supply-inquiry"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const OPENING =
  "היי מנסה להשיג מענה בשירות הלקוחות מעל שבוע ללא הצלחה, רוצה לברר לגבי אספקת הזמנה, אודה על יצירת קשר טלפוני\nעדי"

/** Replay 534252170 — CS-wait complaint must not skip shipping lookup. */
describe("delivery CS wait lookup 534252170", () => {
  it("classifies לברר לגבי אספקת הזמנה as delivery lookup", () => {
    assert.equal(isDeliverySupplyInquiry(OPENING), true)
    assert.equal(isOrderDeliveryStatusQuestion(OPENING), true)
    assert.equal(isShippingStatusQuestion(OPENING), true)
    assert.equal(requiresOrderIdentification(OPENING, []), true)
  })

  it("hints lookup on opening — not immediate human_service", () => {
    const hints = buildConversationHints({ body: OPENING, history: [] }) ?? ""
    assert.match(hints, /534252170/)
    assert.match(hints, /lookup_order_status/i)
    assert.match(hints, /never.*human_service on turn 1/i)
  })

  it("hints lookup when order # arrives after premature handoff", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: OPENING },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nהיי עדי, מצטער... אני מעביר עכשיו לנציג שירות שיחזור אליכם טלפונית לגבי אספקת ההזמנה.",
      },
    ]
    const body = "הזמנה 77675\nטלפון 0523563547"
    assert.equal(extractOrderReference(body, history), "77675")
    const hints = buildConversationHints({ body, history }) ?? ""
    assert.match(hints, /DELIVERY LOOKUP AFTER PREMATURE HANDOFF/i)
    assert.match(hints, /77675/)
    assert.doesNotMatch(hints, /HANDOFF OFFER PENDING/)
  })
})
