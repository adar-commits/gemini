import { normalizeMessageText } from "@/lib/agents/memory"
import type { HistoryMessage } from "@/lib/agents/types"

/** True when outbound text matches a recent bot message — never send duplicates. */
export function isDuplicateAssistantReply(
  history: HistoryMessage[],
  reply: string
) {
  return wasReplyRecentlySent(history, reply, 1)
}

/** Check last N assistant messages for identical content (handles double webhooks). */
export function wasReplyRecentlySent(
  history: HistoryMessage[],
  reply: string,
  lookback = 2
) {
  const normalized = normalizeMessageText(reply)
  if (!normalized) return true

  let seen = 0
  for (let index = history.length - 1; index >= 0 && seen < lookback; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    seen += 1
    if (normalizeMessageText(message.content) === normalized) return true
  }

  return false
}
