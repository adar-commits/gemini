import { isInactivityAssistantMessage } from "@/lib/agents/inactivity"
import { isPostHumanHandoff } from "@/lib/agents/post-handoff"
import type { HistoryMessage } from "@/lib/agents/types"

/** Bot promised backend transfer without a formal handoff offer question. */
export function isTransferPromisedInAssistantText(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return false
  return /(?:תועבר\s+להמשך\s+טיפול|הפנייה\s+תועבר\s+להמשך)/i.test(trimmed)
}

export function isTransferPromisedInThread(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isInactivityAssistantMessage(message.content)) continue
    return isTransferPromisedInAssistantText(message.content)
  }
  return false
}

/** Skip inactivity ping/close only after handoff is confirmed or assigned to a human rep. */
export function shouldSkipInactivityForHumanWait(input: {
  lastAction?: string | null
  lastAssistantText?: string | null
  history?: HistoryMessage[]
}) {
  const action = (input.lastAction ?? "").trim()
  if (action === "human_service" || action === "human_sales") return true

  const text = (input.lastAssistantText ?? "").trim()
  if (text) {
    const history: HistoryMessage[] = [{ role: "assistant", content: text }]
    if (isPostHumanHandoff(null, history)) return true
    if (isTransferPromisedInAssistantText(text)) return true
  }

  if (input.history?.length && isTransferPromisedInThread(input.history)) {
    return true
  }

  return false
}
