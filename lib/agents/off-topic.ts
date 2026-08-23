import type { AgentId, HistoryMessage } from "@/lib/agents/types"
import { hasImmediateBusinessAsk, isCasualGreeting } from "@/lib/agents/greeting"
import { isFaqTopicSwitch } from "@/lib/agents/topic-switch"

export const OFF_TOPIC_HANDOFF_OFFER =
  "אני לא בטוח איך להגיב לזה, שנעביר את השיחה לנציג אנושי?"

function lastAssistantText(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role === "assistant") return message.content
  }
  return ""
}

function matchesOffTopicPattern(text: string) {
  return (
    /(?:את(?:ה|)|זה)\s*(?:רובוט|בוט|אנושי)|רובוט\s+או\s+אנושי|בינה\s+מלאכותית|מי\s+את(?:ה|)|מה\s+את(?:ה|)|are\s+you\s+(?:a\s+)?(?:bot|robot|human|ai)/i.test(
      text
    ) ||
    /^(?:ספר(?:י)?\s+לי\s+)?(?:בדיחה|חידה|סיפור)/i.test(text)
  )
}

export function isHumanHandoffPending(history: HistoryMessage[]) {
  return /שנעביר את השיחה לנציג אנושי/.test(lastAssistantText(history))
}

export function isHumanHandoffAffirmation(body: string) {
  return /^(?:כן|בטח|יאללה|אשמח|בבקשה|סבבה|ok|yes|👍)/i.test(body.trim())
}

export function isHumanHandoffDecline(body: string) {
  return /^(?:לא|לא\s+תודה|עזוב|no)(?:[\s,.!?]|$)/i.test(body.trim())
}

/** Meta / unrelated messages that are not HoM business. */
export function isOffTopicQuestion(body: string) {
  const text = body.trim()
  if (!text || text.length > 240) return false
  if (isCasualGreeting(text)) return false
  if (hasImmediateBusinessAsk(text)) return false
  if (isFaqTopicSwitch(text)) return false
  if (isHumanHandoffAffirmation(text) || isHumanHandoffDecline(text)) return false
  return matchesOffTopicPattern(text)
}

export function inferHumanHandoffAction(
  history: HistoryMessage[],
  lastAgent: AgentId | null
): "human_sales" | "human_service" {
  const transcript = history.map((message) => message.content).join("\n")

  if (lastAgent === "sales") return "human_sales"
  if (lastAgent === "service") return "human_service"

  if (
    /מחפש|רוצ(?:ה|ים|ות)\s+לקנות|שטיח|פוף|תקציב|מחיר|מכירות|יועץ\s+מכירות|התאמת\s+שטיח/i.test(
      transcript
    )
  ) {
    return "human_sales"
  }

  if (
    /הזמנה|משלוח(\s+שלי)?|החזר|תלונה|פגום|לא\s+קיבלתי|חשבונית|נציג\s+שירות/i.test(
      transcript
    )
  ) {
    return "human_service"
  }

  return "human_service"
}

export function buildHumanHandoffConfirmedReply(
  action: "human_sales" | "human_service"
) {
  return action === "human_sales"
    ? "מעולה, העברתי את השיחה ליועץ מכירות. ניצור קשר בהקדם."
    : "מעולה, העברתי את השיחה לנציג שירות. ניצור קשר בהקדם."
}

export function buildHumanHandoffDeclinedReply() {
  return "אין בעיה. אפשר להמשיך מכאן."
}
