import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildExchangeAfterOrderIdentifiedReply,
  isExchangeOrderLookupContinuation,
  isExchangePolicyDeliveryMethodPending,
  isExplicitExchangeExecutionTurn,
} from "@/lib/agents/exchange-intake"
import { buildOrderStatusReply, mapPriorityOrderRow } from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

/** Replay 534464386 — exchange policy → שליח + צבע must not become shipping-status cheer. */
describe("exchange policy delivery choice 534464386", () => {
  const policyReply =
    "*הום בוט :)*\nהיי! 😊 כן, אפשר להחליף. ההחלפה היא תוך 14 יום… תרצו להחליף בסניף או עם שליח?"
  const history: HistoryMessage[] = [
    { role: "user", content: "אפשר להחליף את השטיח" },
    { role: "assistant", content: policyReply },
  ]
  const body = "עם שליח רוצה להחליף לצבע אחר"

  it("detects pending branch/courier question from policy FAQ", () => {
    assert.equal(isExchangePolicyDeliveryMethodPending(history), true)
  })

  it("treats delivery + color answer as explicit exchange execution", () => {
    assert.equal(isExplicitExchangeExecutionTurn(body, history), true)
    assert.equal(isExchangeOrderLookupContinuation(history, body), true)
  })

  it("exchange order identified reply avoids shipping-status card wording", () => {
    const order = mapPriorityOrderRow({
      ORDNAME: "SO26005938",
      REFERENCE: "#76884",
      ZPIT_DELSTATUSCODE: "5",
      ZPIT_DELSTATUSDES: "הועמס לשליח",
      ORDSTATUSDES: "הושלם",
      ZPIT_UDATE: "2026-10-15T13:06:00+03:00",
    })
    const statusCard = buildOrderStatusReply(order)
    assert.match(statusCard, /הועמס לשליח/)

    const exchangeReply = buildExchangeAfterOrderIdentifiedReply(order, body)
    assert.match(exchangeReply, /נמשיך עם החלפה/)
    assert.match(exchangeReply, /איזה סוג החלפה/)
    assert.doesNotMatch(exchangeReply, /איזה כיף/)
    assert.doesNotMatch(exchangeReply, /הועמס לשליח/)
  })

  it("hints exchange continuation after policy delivery answer", () => {
    const hints = buildConversationHints({
      body,
      history,
      whatsappPhone: "0501231643",
    })
    assert.match(hints ?? "", /534464386/)
    assert.match(hints ?? "", /נמשיך עם החלפה/)
  })
})
