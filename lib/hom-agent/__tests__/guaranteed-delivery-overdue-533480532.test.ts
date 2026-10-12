import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildOrderConfirmationPrompt,
  isOrderConfirmationPending,
  mapPriorityOrderRow,
  shippingEtaThreadContinuesAfterPriorOrderConfirm,
  type OrderShipmentStatus,
} from "@/lib/agents/order-lookup"
import {
  clearOrdersLookupCache,
  rememberConversationOrdersLookup,
} from "@/lib/agents/order-lookup-cache"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runStructuredOrderLookupPreTurn } from "@/lib/hom-agent/pre-turn"
import {
  bindPriorityApiLogContext,
  resetPriorityApiTurnState,
} from "@/lib/agents/priority-webhook"
import type { HistoryMessage } from "@/lib/agents/types"

const WHATSAPP = "+972501234567"
const CHANNEL_PHONE = "0501234567"

const order783: OrderShipmentStatus = mapPriorityOrderRow({
  ORDNAME: "SO26023783",
  REFERENCE: "23783",
  BRANCHNAME: "2000",
  ORDISTATUSDES: "ההזמנה הועברה לחברת השליחויות",
  CURDATE: "2026-09-27T00:00:00Z",
})

/** 533480532 — shipping ETA thread + order card + merged confirm/overdue must structured-lookup. */
describe("guaranteed delivery overdue after order card 533480532", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "אני מבקש לדעת מתי תהיה האספקה של המוצרים שהזמנו" },
    { role: "assistant", content: buildOrderConfirmationPrompt(order783) },
    { role: "user", content: "כן" },
    { role: "user", content: "זמן האספקה המובטח כבר כבר" },
    { role: "user", content: "כבר עבר" },
  ]
  const body = "כן זמן האספקה המובטח כבר כבר כבר עבר"

  it("order card confirm stays pending until lookup runs", () => {
    assert.equal(isOrderConfirmationPending(history), true)
    assert.equal(
      shippingEtaThreadContinuesAfterPriorOrderConfirm(history, body),
      true
    )
  })

  it("hints require lookup on shipping ETA thread — not skip-to-handoff", () => {
    const hints = buildConversationHints({ body, history }) ?? ""
    assert.match(hints, /533480532/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /SHIPPING ORDER CONFIRM YES/)
  })

  it("structured pre-turn runs lookup — not cannot-show-status handoff", async () => {
    resetPriorityApiTurnState()
    clearOrdersLookupCache()
    bindPriorityApiLogContext({
      conversationId: "533480532",
      whatsappPhone: WHATSAPP,
    })
    rememberConversationOrdersLookup("533480532", CHANNEL_PHONE, [order783])

    const result = await runStructuredOrderLookupPreTurn({
      turn: { text: body, media: [] },
      history,
      phone: WHATSAPP,
    })

    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "reply")
    assert.match(result.reply, /בדקתי/)
    assert.doesNotMatch(result.reply, /מעביר.*לנציג/i)
  })
})
