import { getTurnProgress } from "@/lib/agent-core/turn-metrics"
import { wasPriorityApiPreMessageSentThisTurn } from "@/lib/agents/priority-webhook"

/** One invoke retry only when nothing customer-visible or LLM-partial happened yet. */
export function shouldRetryInvokeAfterFailure(conversationId: string) {
  const progress = getTurnProgress(conversationId)
  if (!progress) return false
  if (progress.llmCalls > 0 || progress.inputTokens > 0 || progress.outputTokens > 0) {
    return false
  }
  if (progress.routingPath === "v3_tools") return false
  if (wasPriorityApiPreMessageSentThisTurn()) return false

  return true
}
