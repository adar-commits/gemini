import type { HistoryMessage } from "@/lib/agents/types"
import { isVoiceClosureTemplateLastOutbound } from "@/lib/agents/memory"
import { isVoiceClosureTemplateMessage } from "@/lib/landbot/voice-closure-template"

export function isVoiceClosureTemplateInHistory(history: HistoryMessage[]) {
  const lastAssistant = [...history].reverse().find((message) => message.role === "assistant")
  return isVoiceClosureTemplateMessage(lastAssistant ? { body: lastAssistant.content } : null)
}

/** Customer is replying after the dashboard voice-closure template — bot must answer, not stay silent. */
export async function isVoiceClosureReplyPending(
  conversationId: string,
  history: HistoryMessage[]
) {
  if (isVoiceClosureTemplateInHistory(history)) return true
  return isVoiceClosureTemplateLastOutbound(conversationId).catch(() => false)
}

/** Skip sending voice-closure template again when it is already the last outbound. */
export async function shouldSkipVoiceClosureTemplateSend(conversationId: string) {
  return isVoiceClosureTemplateLastOutbound(conversationId).catch(() => false)
}
