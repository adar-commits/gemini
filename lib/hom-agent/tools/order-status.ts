import { resolveOrderShippingReply } from "@/lib/agents/order-lookup"
import { isActiveReturnExchangePickupCase, classifyPostPurchaseCase } from "@/lib/agents/inquiry-intent"
import { isPostPurchaseServiceFlow } from "@/lib/agents/service-intake"

export async function executeLookupOrderStatus(input: {
  body: string
  phone?: string
  history?: { role: "user" | "assistant"; content: string }[]
}) {
  const history = input.history ?? []
  const body = input.body.trim()

  if (
    isActiveReturnExchangePickupCase(body) ||
    classifyPostPurchaseCase(body) === "return_pickup_pending" ||
    isPostPurchaseServiceFlow(history)
  ) {
    return {
      ok: false as const,
      error:
        "Return/exchange pickup wait is a service case — confirm intent and use service handoff summary, not shipping status lookup.",
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
