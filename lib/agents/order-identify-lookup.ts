import { messageAwaits } from "@/lib/agents/bot-awaiting"
import { isExchangeOrderRequired } from "@/lib/agents/exchange-intake"
import { isInactivityAssistantMessage } from "@/lib/agents/inactivity"
import {
  isOrderConfirmationPending,
  isServiceHandoffOrderLookupReply,
  isOrderLookupPhoneReplyPending,
  isOrderNumberRequestPending,
  isPhoneLookupConfirmPending,
  type OrderShipmentStatus,
} from "@/lib/agents/order-lookup"
import type { HistoryMessage } from "@/lib/agents/types"

/**
 * Order lookup ≠ shipment status (505729214). The bot asked for the order only to identify it
 * for another request (billing, exchange, return, cancel), tagged `awaiting: order_identify`.
 * The chain stays open while every later assistant row is still a lookup step
 * (order card, phone confirm, order-number ask).
 */
export function isIdentificationOnlyOrderLookup(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isInactivityAssistantMessage(message.content)) continue
    if (messageAwaits(message, "order_identify")) return true
    if (!isOrderLookupStepMessage(message)) return false
  }
  return false
}

/** Identify-only chain, or an exchange that still needs its order (532899816). */
export function isOrderIdentificationForRequest(history: HistoryMessage[]) {
  return isIdentificationOnlyOrderLookup(history) || isExchangeOrderRequired(history)
}

/**
 * The lookup resolved the order inside an identification chain — the LLM continues the
 * original request with the order data. Service summaries still go out, except during
 * an exchange (the customer chose החלפה; a corpus «להחזיר» opener must not relabel it).
 */
export function shouldReleaseResolvedOrderToLlm(history: HistoryMessage[], reply: string) {
  if (!isOrderIdentificationForRequest(history)) return false
  if (isOrderLookupPromptReply(history, reply)) return false
  if (isServiceHandoffOrderLookupReply(reply) && !isExchangeOrderRequired(history)) return false
  return true
}

export function isOrderLookupPromptReply(history: HistoryMessage[], reply: string) {
  return isOrderLookupStepMessage({ role: "assistant", content: reply }, history)
}

function isOrderLookupStepMessage(message: HistoryMessage, history: HistoryMessage[] = []) {
  const single = [...history, { role: "assistant" as const, content: message.content }]
  return (
    isOrderConfirmationPending(single) ||
    isPhoneLookupConfirmPending(single) ||
    isOrderLookupPhoneReplyPending(single) ||
    isOrderNumberRequestPending(single)
  )
}

const SHIPPING_CODE_MEANINGS =
  "Shipping code (ZPIT_DELSTATUSCODE): empty = not yet handled by logistics; 1 = packed, still in our warehouse awaiting courier; 3 loaded; 4 awaiting dispatch; 5 en route; 6 delivered by courier; 21 self-pickup processing; 22 ready for pickup; 23 self-collected; 80 delivery coordinated."

export function buildIdentifiedOrderToolResult(order: OrderShipmentStatus, playbook?: string) {
  return {
    ok: true as const,
    identifiedOrder: {
      orderNumber: order.orderNumber,
      shippingStatusCode: order.statusCode || null,
      shippingStatus: order.statusLabel || null,
      orderStatus: order.orderStatus ?? null,
      deliveryType: order.deliveryType ?? null,
      promisedDelivery: order.promisedDelivery ?? null,
      totalPrice: order.totalPrice,
      lineItems: (order.lineItems ?? []).map((line) => ({
        name: line.name,
        sku: line.sku ?? null,
        quantity: line.quantity ?? null,
        preorderExpectedDate: line.preorderExpectedDate ?? null,
      })),
    },
    instruction: `ORDER IDENTIFIED FOR REQUEST (505729214): the customer confirmed order ${order.orderNumber}. This lookup was only to identify the order — do NOT send a shipment-status card or "בדקתי, סטטוס ההזמנה". Continue the customer's original request (billing / exchange / return / cancel / product) using this data and the matching playbook. ${SHIPPING_CODE_MEANINGS}${playbook ? ` ${playbook}` : ""}`,
  }
}
