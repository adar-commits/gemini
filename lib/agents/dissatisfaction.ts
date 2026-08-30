import { CUSTOMER_HEADER, type HistoryMessage } from "@/lib/agents/types"
import { isInactivityAssistantMessage } from "@/lib/agents/inactivity"

import { isPostPurchaseDissatisfaction } from "@/lib/agents/inquiry-intent"
import { buildReturnPolicyBody } from "@/lib/agents/policy-subjects"

/** Customer unhappy after delivery without defect wording — FAQ return/exchange policy first. */
export function isDissatisfactionWithoutDefect(body: string) {
  return isPostPurchaseDissatisfaction(body)
}

export const DISSATISFACTION_RESCUE_MARKER =
  "לפני שמסיימים — אולי עדיין נוכל למצוא שטיח שיתאים יותר"

export const DISSATISFACTION_RESCUE_CLARIFY_MARKER =
  "יועץ מכירות שיעזור למצוא שטיח שמתאים יותר, או נציג שירות"

export function isDissatisfactionRescuePending(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isInactivityAssistantMessage(message.content)) continue
    if (message.content.includes(DISSATISFACTION_RESCUE_MARKER)) return true
    if (message.content.includes(DISSATISFACTION_RESCUE_CLARIFY_MARKER)) return true
    return false
  }
  return false
}

export type DissatisfactionRescueChoice = "sales" | "service" | "portal" | "clarify"

export function resolveDissatisfactionRescueChoice(
  body: string
): DissatisfactionRescueChoice | null {
  const text = body.trim()
  if (!text) return null

  if (/פורטל|returns\.carpetshop|בעצמ(?:י|נו)?|דרך\s+ה(?:אתר|קישור)/i.test(text)) {
    return "portal"
  }
  if (
    /מכירות|יועץ|שטיח\s+אחר|דגם\s+אחר|מתאים\s+יותר|^החלפה(?:[\s,.!?]|$)/i.test(text)
  ) {
    return "sales"
  }
  if (/החזרה|שירות|נציג|זיכוי|לבטל|ביטול/i.test(text)) {
    return "service"
  }
  if (/^(?:כן|בטח|יאללה|אשמח|בסדר|מעולה|ok|yes|👍)(?:[\s,.!?]|$)/i.test(text)) {
    return "clarify"
  }

  return null
}

export function buildDissatisfactionRescueClarifyReply() {
  return `${CUSTOMER_HEADER}
מעולה — ${DISSATISFACTION_RESCUE_CLARIFY_MARKER} לבקשת החזרה?`
}

export function buildDissatisfactionRescuePortalReply() {
  return `${CUSTOMER_HEADER}
אין בעיה — אפשר לפתוח בקשת החזרה בפורטל:
https://returns.carpetshop.co.il/
אם צריך עזרה בתהליך, אפשר גם לבקש נציג שירות.`
}

/** Full return options + save-the-purchase paths (sales / service / portal). */
export function buildDissatisfactionRescueReply() {
  return `${CUSTOMER_HEADER}
מצטער לשמוע שהשטיח לא התחבר אליך.

${buildReturnPolicyBody()}

${DISSATISFACTION_RESCUE_MARKER}:
• יועץ מכירות — יעזור לבחור דגם שמתאים יותר לחלל ולטעם
• נציג שירות — ילווה בבקשת החזרה לפי מדיניות
• פורטל ההחזרות — לפתיחת בקשה עצמאית (הקישור למעלה)

מה מתאים — יועץ מכירות, נציג שירות, או פורטל?`
}
