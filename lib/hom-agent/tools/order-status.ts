import { resolveOrderShippingReply } from "@/lib/agents/order-lookup"

export async function executeLookupOrderStatus(input: {
  body: string
  phone?: string
  history?: { role: "user" | "assistant"; content: string }[]
}) {
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
