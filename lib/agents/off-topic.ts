import type { AgentId, HistoryMessage } from "@/lib/agents/types"
import { hasImmediateBusinessAsk, isCasualGreeting } from "@/lib/agents/greeting"
import { isInactivityAssistantMessage } from "@/lib/agents/inactivity"
import { isPureHandoffAffirmation, isPureHandoffDecline } from "@/lib/agents/compound-reply"
import { isFaqTopicSwitch } from "@/lib/agents/topic-switch"

export const OFF_TOPIC_HANDOFF_OFFER =
  "אני לא בטוח איך להגיב לזה, שאעביר את השיחה לנציג אנושי?"

/** Meta / playful / unrelated — stay in chat, do not dump to a human. */
export const OFF_TOPIC_REDIRECT =
  "כן, אני הום בוט :) כאן בעיקר לגבי הזמנות, מוצרים ושירות. במה אפשר לעזור?"

function lastAssistantText(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isInactivityAssistantMessage(message.content)) continue
    return message.content
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

export function isHumanHandoffOfferText(text: string) {
  const last = text.trim()
  if (!last) return false
  return (
    /שאעביר את השיחה לנציג אנושי/.test(last) ||
    /שנעביר את השיחה לנציג אנושי/.test(last) ||
    /האם להעביר את הפנייה כעת ליועץ מכירות/.test(last) ||
    /נציג שירות אנושי,בסדר\?/.test(last) ||
    /האם להעביר (?:את השיחה )?(?:ל)?נציג שירות/.test(last) ||
    /האם להעביר לנציג שירות/.test(last) ||
    /האם להעביר (?:את )?(?:ה)?פנייה/.test(last) ||
    /האם להעביר ליועץ מכירות/.test(last) ||
    /(?:להעביר|שאעביר).{0,40}נציג.{0,40}\?/.test(last) ||
    /לא לגמרי הבנתי.*(?:להעביר|נציג)/.test(last) ||
    /שאעביר את השיחה לנציג שירות/.test(last)
  )
}

export function isHumanHandoffPending(history: HistoryMessage[]) {
  return isHumanHandoffOfferText(lastAssistantText(history))
}

export function isHumanHandoffAffirmation(body: string) {
  const text = body.trim()
  if (!text || text.length > 80) return false
  return /^(?:כן|בטח|יאללה|אשמח|בבקשה|סבבה|בסדר|מעולה|ok|yes|👍|אוקיי|אוקי|okay)(?:[\s,.!?]|$)/i.test(
    text
  )
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
  if (isPureHandoffAffirmation(text) || isPureHandoffDecline(text)) return false
  return matchesOffTopicPattern(text)
}

/** Explicit new-purchase / model-selection intent — not generic product mentions. */
export function isExplicitSalesHandoffIntent(text: string) {
  return (
    /(?:עזור(?:ו)?\s+(?:לי|לנו)\s+(?:לבחור|למצוא)|יועץ\s+מכירות|מחלקת\s+מכירות|התאמת\s+שטיח|ל(?:בחור|מצוא)\s+דגם|דגם\s+אחר\s+ש(?:יתאים|מתאים)|מעבר\s+ל(?:דגם|מוצר)\s+אחר|איזה\s+דגם\s+(?:מתאים|ל(?:בחור|קנות)))/i.test(
      text
    ) ||
    /(?:רוצ(?:ה|ים|ות)\s+(?:ל)?(?:קנות|לרכוש)|מחפש(?:ים|ת|ים)?\s+(?:ל)?(?:קנות|לרכוש)|שטיח\s+ל(?:סלון|חדר)|כמה\s+עולה|תקציב)/i.test(
      text
    )
  )
}

export function inferHumanHandoffAction(
  history: HistoryMessage[],
  lastAgent: AgentId | null
): "human_sales" | "human_service" {
  const transcript = history.map((message) => message.content).join("\n")
  const last = lastAssistantText(history)

  if (/האם להעביר את הפנייה כעת ליועץ מכירות/.test(last)) {
    return "human_sales"
  }

  if (lastAgent === "sales" && isExplicitSalesHandoffIntent(transcript)) {
    return "human_sales"
  }

  if (isExplicitSalesHandoffIntent(transcript)) {
    return "human_sales"
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
