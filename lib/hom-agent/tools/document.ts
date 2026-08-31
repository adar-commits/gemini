import { resolveDigitalDocumentFlowReply } from "@/lib/agents/digital-document-flow"
import type { HistoryMessage } from "@/lib/agents/types"

export async function executeFetchDigitalDocument(input: {
  body: string
  phone?: string
  history?: HistoryMessage[]
}) {
  try {
    const reply = await resolveDigitalDocumentFlowReply({
      body: input.body,
      phone: input.phone,
      history: input.history ?? [],
    })
    return { ok: true as const, reply: reply.trim() }
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Document lookup failed",
    }
  }
}
