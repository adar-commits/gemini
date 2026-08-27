import type { HistoryMessage } from "@/lib/agents/types"
import { isInactivityAssistantMessage } from "@/lib/agents/inactivity"

const HANDOFF_CONFIRMED_RE =
  /העבר(?:תי|נו)\s+א(?:ת|ת)\s+ה(?:שיחה|פנייה)|הפנייה\s+הועברה|ניצור\s+קשר\s+בהקדם/i

function lastMeaningfulAssistantText(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isInactivityAssistantMessage(message.content)) continue
    return message.content
  }
  return ""
}

export function isPostHumanHandoff(lastAction: string | null, history: HistoryMessage[]) {
  if (lastAction === "human_sales" || lastAction === "human_service") return true
  return HANDOFF_CONFIRMED_RE.test(lastMeaningfulAssistantText(history))
}

export function postHandoffKind(
  lastAction: string | null,
  history: HistoryMessage[]
): "human_sales" | "human_service" | null {
  if (lastAction === "human_sales") return "human_sales"
  if (lastAction === "human_service") return "human_service"
  const last = lastMeaningfulAssistantText(history)
  if (/יועץ\s+מכירות|מחלקת\s+מכירות/i.test(last)) return "human_sales"
  if (/נציג\s+שירות|שירות\s+לקוחות/i.test(last)) return "human_service"
  return null
}

/** Gentle reminder on the last FAQ answer after handoff — not on every bubble. */
export function buildPostHandoffFooter(kind: "human_sales" | "human_service") {
  return kind === "human_sales"
    ? "היועץ כבר קיבל את הפנייה ויצור קשר — בינתיים שמח לעזור."
    : "הנציג כבר קיבל את הפנייה ויצור קשר — בינתיים שמח לעזור."
}
