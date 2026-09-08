import {
  buildReturnPickupAwaitingServiceReply,
  extractServiceIntake,
  isPostPurchaseServiceFlow,
  isReturnPickupAwaitingThread,
} from "@/lib/agents/service-intake"
import {
  classifyPostPurchaseCase,
  isActiveReturnExchangePickupCase,
  isPurchaseCompletionStatement,
  isReturnEligibilityQuestion,
} from "@/lib/agents/inquiry-intent"
import {
  enrichReturnPickupIntake,
  isOrderConfirmationPending,
  isOrderLookupPhoneReplyPending,
  requiresOrderIdentification,
  resolveOrderShippingReply,
} from "@/lib/agents/order-lookup"
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
  const needsOrderLookup = requiresOrderIdentification(body, history)

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

  if (isPostPurchaseServiceFlow(history)) {
    return {
      ok: false as const,
      error:
        "Service handoff in progress — continue summary confirm, not shipping lookup.",
    }
  }

  if (!needsOrderLookup && !returnPickupContextInThread(history, body)) {
    return {
      ok: false as const,
      errorCode: "lookup_misroute",
      error:
        "Likely wrong tool call for this turn (no clear order/shipping intent). Do not ask for order/phone. Re-read the customer intent and answer directly from context/KB.",
    }
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

  try {
    const reply = await resolveOrderShippingReply({
      body: input.body,
      phone: input.phone,
      history: input.history ?? [],
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
