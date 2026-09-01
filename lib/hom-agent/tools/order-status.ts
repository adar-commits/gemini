import { resolveOrderShippingReply } from "@/lib/agents/order-lookup"
import {
  isActiveReturnExchangePickupCase,
  classifyPostPurchaseCase,
} from "@/lib/agents/inquiry-intent"
import {
  isPostPurchaseServiceFlow,
  isReturnPickupAwaitingThread,
} from "@/lib/agents/service-intake"
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

  if (
    returnPickupContextInThread(history, body) ||
    isPostPurchaseServiceFlow(history)
  ) {
    return {
      ok: false as const,
      error:
        "Return pickup wait — customer already filed return and awaits courier. Use service summary + human_service; never shipping/self-pickup status.",
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
