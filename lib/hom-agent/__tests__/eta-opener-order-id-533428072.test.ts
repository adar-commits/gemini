import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  extractOrderReference,
  isOrderDeliveryStatusQuestion,
} from "@/lib/agents/order-lookup"
import { isShippingStatusQuestion } from "@/lib/agents/shipping"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

/** 533428072 — ETA opener + order # in merged first turn must lookup, not human_service. */
describe("ETA opener order id 533428072", () => {
  const history: HistoryMessage[] = []
  const body = "היי מתי אני אקבל את השטיח שהזמנתי? הזמנה 77670"

  it("detects shipping ask and order reference in merged opener", () => {
    assert.equal(isShippingStatusQuestion(body), true)
    assert.equal(isOrderDeliveryStatusQuestion(body), true)
    assert.equal(extractOrderReference(body, history), "77670")
  })

  it("hints lookup_order_status — not generic SLA + human_service", () => {
    const hints = buildConversationHints({ body, history }) ?? ""
    assert.match(hints, /533428072/)
    assert.match(hints, /77670/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /never.*human_service/i)
  })
})
