import {
  buildReturnPickupAwaitingServiceReply,
  extractServiceIntake,
  isPostPurchaseServiceFlow,
  isReturnPickupAwaitingThread,
} from "@/lib/agents/service-intake"
import { isActiveDigitalDocumentFlow } from "@/lib/agents/digital-document-flow"
import {
  getDissatisfactionRescueStage,
  shouldOfferReturnOptionsFirst,
} from "@/lib/agents/dissatisfaction"
import { isExchangeIntakeActive } from "@/lib/agents/exchange-intake"
import {
  classifyPostPurchaseCase,
  isActiveReturnExchangePickupCase,
  isOrderModificationRequest,
  isPurchaseCompletionStatement,
  isReturnEligibilityQuestion,
} from "@/lib/agents/inquiry-intent"
import {
  buildPostOrderLookupContinuationReply,
  enrichReturnPickupIntake,
  isOrderConfirmationPending,
  isOrderLookupCompletedInThread,
  orderIdGivenInThread,
  isShippingAddressUpdateThread,
  shouldLookupKnownOrderForCancel,
  shouldRefuseKnownOrderLookup,
  isOrderLookupPhoneReplyPending,
  isServiceOrderIdentificationFlow,
  requiresOrderIdentification,
  resolveOrderShippingReply,
  shouldAllowOrderLookupRestart,
} from "@/lib/agents/order-lookup"
import { isResolvedStatusCloseReply } from "@/lib/agents/conversation-close"
import type { HistoryMessage } from "@/lib/agents/types"

function returnPickupContextInThread(
  history: HistoryMessage[],
  body: string
) {
  return (
    isReturnPickupAwaitingThread(history, body) ||
    isActiveReturnExchangePickupCase(body) ||
    classifyPostPurchaseCase(body) === "return_pickup_pending"
  )
}

export async function executeLookupOrderStatus(input: {
  body: string
  phone?: string
  history?: HistoryMessage[]
  lookupHint?: string
}) {
  const history = input.history ?? []
  const body = input.body.trim()

  const knownOrder = orderIdGivenInThread(history)
  if (shouldLookupKnownOrderForCancel(body, history)) {
    return deliverOrderLookupReply(input)
  }

  if (knownOrder && shouldRefuseKnownOrderLookup(body, history)) {
    return {
      ok: false as const,
      errorCode: "lookup_misroute",
      error: `KNOWN ORDER ${knownOrder} (532748267): this order id is already in the thread from the receipt. Do NOT call lookup_order_status and do NOT ask for מספר הזמנה or a phone confirm. Ask once whether they mean order ${knownOrder}. After they confirm (כן / היי, כן / ההזמנה האחרונה), call lookup with that id only — never a different newest order on the phone.`,
    }
  }

  if (isShippingAddressUpdateThread(history)) {
    return {
      ok: false as const,
      errorCode: "lookup_misroute",
      error:
        "SHIPPING ADDRESS UPDATE (532692073): this thread is a request to change the delivery address, not a shipment-status ask. Do NOT call lookup_order_status and do NOT send a בדקתי status card. Answer from shipping-policy KB: updating the address is not always possible — it depends on whether the order was already handed to the courier. After handover there is a cost; WhatsApp 077-9725055 or *3076. Do not ask them to type the new address or an order number. action reply.",
    }
  }

  const needsOrderLookup = requiresOrderIdentification(body, history)
  const lookupAllowed =
    needsOrderLookup ||
    isOrderModificationRequest(body) ||
    isOrderConfirmationPending(history) ||
    isOrderLookupPhoneReplyPending(history)

  if (!lookupAllowed) {
    return {
      ok: false as const,
      errorCode: "lookup_misroute",
      error:
        "No live order/shipping ask this turn. Do NOT start getOrders or phone-confirm. Product page / פרטים נוספים / catalog photo (carpetshop.co.il or pozitiveshop.co.il) is sales — answer from KB or continue sales intake with crm_department sales.",
    }
  }

  if (
    isPurchaseCompletionStatement(body) &&
    !isOrderConfirmationPending(history) &&
    !isOrderLookupPhoneReplyPending(history)
  ) {
    return {
      ok: false as const,
      error:
        "Customer only stated they already completed a purchase — no question or problem. Do NOT start an order lookup. Reply warmly yourself: congratulate (e.g. תתחדשו! 😊) and offer further help.",
    }
  }

  if (isReturnEligibilityQuestion(body, history)) {
    return {
      ok: false as const,
      error:
        "Return eligibility / policy FAQ — answer from KB (14 days from receipt, portal, branch or paid courier). Do not look up order status.",
    }
  }

  if (isActiveDigitalDocumentFlow(history, body)) {
    return {
      ok: false as const,
      errorCode: "lookup_misroute",
      error:
        "Receipt/invoice copy thread — use fetch_digital_document (getDocument API), not lookup_order_status/getOrders.",
    }
  }

  const rescueStage = getDissatisfactionRescueStage(history)
  if (rescueStage === "sales_offer" && !isExchangeIntakeActive(history)) {
    return {
      ok: false as const,
      error:
        "Customer is choosing between exchange and return — use dissatisfaction playbook (portal for return; exchange → order lookup after they choose החלפה). Do NOT start order lookup until they choose.",
    }
  }

  if (shouldOfferReturnOptionsFirst(body, history)) {
    return {
      ok: false as const,
      error:
        "Bare return / dissatisfaction opening — offer exchange + return options first (יש שתי אפשרויות). Do NOT ask for order number or call lookup until they choose return execution or need pickup-wait service.",
    }
  }

  if (isPostPurchaseServiceFlow(history) || isServiceOrderIdentificationFlow(history, body)) {
    return {
      ok: false as const,
      error:
        "Service thread — order lookup is only for מס׳ הזמנה. After customer confirms the order card, continue service rep report (summary bullets + check, awaiting service_summary_confirm) → human_service. Never shipping status or משהו נוסף.",
    }
  }

  if (
    isOrderLookupCompletedInThread(history) &&
    !shouldAllowOrderLookupRestart(body, history)
  ) {
    const reply = await buildPostOrderLookupContinuationReply({
      body,
      history,
      whatsappPhone: input.phone,
    })
    if (reply == null) {
      return {
        ok: false as const,
        error:
          "ORDER LOOKUP COMPLETED: answer the customer's question directly from thread context — never say 'כבר מצאנו את ההזמנה' and never offer unsolicited ביטול/החזרה/העברה menus. Shipping follow-ups (מתי יגיע, עבר שבוע, למה לא קיבלתי) → status/timeline from last lookup. A complete status answer is enough — do NOT append האם להעביר לנציג. human_service only if they ask for a rep, status is unknown, or marked delivered and they say it did not arrive.",
      }
    }
    const action = /העברתי את השיחה/i.test(reply)
      ? ("human_service" as const)
      : ("reply" as const)
    return { ok: true as const, reply, action }
  }

  if (returnPickupContextInThread(history, body)) {
    let intake = extractServiceIntake(history, body)
    intake.issueKind = "return_pickup_pending"
    intake = await enrichReturnPickupIntake(intake, {
      body,
      phone: input.phone,
      history,
      lookupHint: input.lookupHint,
    })
    return {
      ok: true as const,
      reply: buildReturnPickupAwaitingServiceReply(intake, body, history),
      action: "reply" as const,
    }
  }

  return deliverOrderLookupReply(input)
}

async function deliverOrderLookupReply(input: {
  body: string
  phone?: string
  history?: HistoryMessage[]
  lookupHint?: string
}) {
  try {
    const reply = await resolveOrderShippingReply({
      body: input.body,
      phone: input.phone,
      history: input.history ?? [],
      lookupHint: input.lookupHint,
    })
    const trimmed = reply.trim()
    // Only a genuine confusion reply counts as non-definitive. The flow's own
    // clarify steps (phone confirm, order-number ask) are the lookup WORKING —
    // they must be sent verbatim, never rejected back to the LLM (which would
    // hallucinate order data instead of running the real flow; see 528509859).
    if (isNonDefinitiveLookupReply(trimmed)) {
      return {
        ok: false as const,
        errorCode: "lookup_non_definitive",
        error:
          "Order lookup could not interpret this turn. Answer the customer directly from context/KB; only retry the tool if they explicitly ask about a specific order status.",
      }
    }
    const action = /לא ניתן להציג כרגע סטטוס משלוח/i.test(trimmed)
      ? ("human_service" as const)
      : isResolvedStatusCloseReply(trimmed)
        ? ("end" as const)
        : ("reply" as const)

    return { ok: true as const, reply: trimmed, action }
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Order lookup failed",
    }
  }
}

function isNonDefinitiveLookupReply(reply: string) {
  return /לא הבנתי/i.test(reply)
}
