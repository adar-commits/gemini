import {
  buildReturnPickupAwaitingServiceReply,
  extractServiceIntake,
  isPostPurchaseServiceFlow,
  isReturnPickupAwaitingThread,
} from "@/lib/agents/service-intake"
import {
  classifyPostPurchaseCase,
  isActiveReturnExchangePickupCase,
  isReturnEligibilityQuestion,
} from "@/lib/agents/inquiry-intent"
import {
  enrichReturnPickupIntake,
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
}) {
  const history = input.history ?? []
  const body = input.body.trim()

  if (isReturnEligibilityQuestion(body, history)) {
    return {
      ok: false as const,
      error:
        "Return eligibility / policy FAQ — answer from KB (14 days from receipt, portal, branch or paid courier). Do not look up order status.",
    }
  }

  if (returnPickupContextInThread(history, body)) {
    let intake = extractServiceIntake(history, body)
    intake.issueKind = "return_pickup_pending"
    intake = await enrichReturnPickupIntake(intake, {
      body: input.body,
      phone: input.phone,
      history,
    })
    return {
      ok: true as const,
      reply: buildReturnPickupAwaitingServiceReply(intake, body),
      action: "reply" as const,
    }
  }

  if (isPostPurchaseServiceFlow(history)) {
    return {
      ok: false as const,
      error:
        "Service handoff in progress — continue summary confirm, not shipping lookup.",
    }
  }

  try {
    const reply = await resolveOrderShippingReply({
      body: input.body,
      phone: input.phone,
      history: input.history ?? [],
    })
    const trimmed = reply.trim()
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
