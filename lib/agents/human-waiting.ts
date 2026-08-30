import { isHumanHandoffOfferText } from "@/lib/agents/off-topic"
import { isPostHumanHandoff } from "@/lib/agents/post-handoff"
import type { HistoryMessage } from "@/lib/agents/types"

/** Skip inactivity ping/close while waiting on or assigned to a human rep. */
export function shouldSkipInactivityForHumanWait(input: {
  lastAction?: string | null
  lastAssistantText?: string | null
}) {
  const action = (input.lastAction ?? "").trim()
  if (action === "human_service" || action === "human_sales") return true

  const text = (input.lastAssistantText ?? "").trim()
  if (!text) return false
  if (isHumanHandoffOfferText(text)) return true

  const history: HistoryMessage[] = [{ role: "assistant", content: text }]
  return isPostHumanHandoff(null, history)
}
