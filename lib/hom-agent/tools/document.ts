import {
  activeDigitalDocumentRequest,
  isAlternateDocumentPhonePending,
  isDigitalDocumentRequest,
  isDocumentChannelQuestionPending,
  isDocumentFlowMisunderstandingPending,
  isDocumentPhoneLookupPending,
  isDocumentPurchaseLocationQuestionPending,
  isDocumentTypeQuestionPending,
  resolveDigitalDocumentFlowReply,
} from "@/lib/agents/digital-document-flow"
import type { HistoryMessage } from "@/lib/agents/types"

export async function executeFetchDigitalDocument(input: {
  body: string
  phone?: string
  history?: HistoryMessage[]
}) {
  const history = input.history ?? []
  const body = input.body.trim()
  const hasDocumentContext =
    isDigitalDocumentRequest(body) ||
    activeDigitalDocumentRequest(history) ||
    isDocumentTypeQuestionPending(history) ||
    isDocumentPurchaseLocationQuestionPending(history) ||
    isDocumentChannelQuestionPending(history) ||
    isDocumentPhoneLookupPending(history) ||
    isAlternateDocumentPhonePending(history) ||
    isDocumentFlowMisunderstandingPending(history)
  if (!hasDocumentContext) {
    return {
      ok: false as const,
      errorCode: "document_misroute",
      error:
        "Likely wrong tool call for this turn (no receipt/invoice intent). Re-read customer intent and answer directly without document lookup.",
    }
  }

  try {
    const reply = await resolveDigitalDocumentFlowReply({
      body: input.body,
      phone: input.phone,
      history,
    })
    return { ok: true as const, reply: reply.trim() }
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Document lookup failed",
    }
  }
}
