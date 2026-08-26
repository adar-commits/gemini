import {
  isSpecialistId,
  MASTER_ROUTE_MAP,
  type AgentId,
  type MasterAction,
  type SpecialistId,
} from "@/lib/agents/types"
import type { HistoryMessage } from "@/lib/agents/types"
import {
  hasOngoingSalesIntake,
  isConfirmationPending,
  isIntakeTopicPivot,
  isSalesQuizContext,
} from "@/lib/agents/sales-intake"
import { isProductAvailabilityQuestion } from "@/lib/agents/product-handoff"
import { isCustomerServiceOpener } from "@/lib/agents/customer-service-opener"
import {
  isFaqTopicSwitch,
  isSalesTopicSwitch,
  isServiceTopicSwitch,
  isShippingStatusQuestion,
} from "@/lib/agents/topic-switch"
import { isHumanHandoffPending } from "@/lib/agents/off-topic"
import { breaksPendingHandoff } from "@/lib/agents/handoff-wait"
import { isConversationClosing, isNonSubstantiveFollowUp } from "@/lib/agents/conversation-close"
import { isDissatisfactionWithoutDefect } from "@/lib/agents/dissatisfaction"
import {
  isPostPurchaseDissatisfaction,
  isPreorderDelayComplaint,
  isProductDefectComplaint,
} from "@/lib/agents/inquiry-intent"

const BREAK_STICKY = new Set([
  "reset",
  "end",
  "shipping",
  "human_sales",
  "human_service",
  "invoice_tax",
  "invoice_tax_receipt",
  "receipt",
  "ROUTE_TO_SHIPPING_STATUS",
])

export function stickySpecialist(
  lastAgent: AgentId | null,
  lastAction: string | null
): SpecialistId | null {
  if (!lastAgent || !isSpecialistId(lastAgent)) return null
  if (lastAction && BREAK_STICKY.has(lastAction)) return null
  return lastAgent
}

function has(text: string, pattern: RegExp) {
  return pattern.test(text)
}

/** Obvious first-message routes. Returns null when the intent is unclear. */
export function guessMasterRoute(body: string): MasterAction | null {
  const text = body.trim()
  if (!text) return null

  if (isCustomerServiceOpener(text)) {
    return "ROUTE_TO_INFO_AGENT"
  }

  if (isServiceTopicSwitch(text)) {
    return "ROUTE_TO_SERVICE_AGENT"
  }

  if (isFaqTopicSwitch(text)) {
    return "ROUTE_TO_INFO_AGENT"
  }

  if (isShippingStatusQuestion(text) && !isPreorderDelayComplaint(text)) {
    return "ROUTE_TO_SHIPPING_STATUS"
  }

  if (
    isPostPurchaseDissatisfaction(text) ||
    isPreorderDelayComplaint(text) ||
    isProductDefectComplaint(text)
  ) {
    return "ROUTE_TO_SERVICE_AGENT"
  }

  if (
    has(text, /קרוע|פגום|פגם|פגומ(?:ה|ים|ות)|שבור|סדוק|ליקוי|תלונה/) ||
    has(text, /(?:קיבלתי|הגיע(?:ה|ו)?).*(?:פגם|פגום|קרוע|שבור|ליקוי)/) ||
    has(text, /(?:יש|קיים)\s+(?:ב(?:ו|ה|הם)?\s+)?(?:פגם|ליקוי)/) ||
    has(text, /לא\s+קיבלתי|מוצר\s+לא\s+נכון|חסר(ים)?\s+ב/) ||
    has(text, /הגיע\s+(קרוע|פגום|שבור|לא\s+נכון)/)
  ) {
    return "ROUTE_TO_SERVICE_AGENT"
  }

  if (
    has(text, /לא\s+עונים|התאמת\s+מחיר|ו?זיכוי\s+כספי|מבצע.*\d+\s*%|לא\s+מה\s+שדיברנו|תלונה/) ||
    has(text, /חייב(?:ו|ת)?\s+אותי|טעות\s+ב(?:ה)?זמנה/)
  ) {
    return "ROUTE_TO_SERVICE_AGENT"
  }

  if (
    has(text, /רוצה\s+לקנות|ייעוץ\s+עיצוב|עוזר\s+לבחור/) ||
    has(text, /תקציב|עד\s+[\d,]+|מחפש(?:ים|ת|ים)?\s+שטיח/) ||
    has(text, /שטיח\s+ל(סלון|חדר|מטבח|כניסה|מרפסת)/)
  ) {
    return "ROUTE_TO_SALES_AGENT"
  }

  if (
    has(text, /במלאי|יש\s+(?:ל(?:כם|נו)|אצל(?:כם|נו))\s+(?:את\s+)?|קיים\s+ב?מלאי|דגם\s+\S+|קזבל|גארד|מילאן|sku/i) ||
    has(text, /כמה\s+עולה|מחיר\s+של/)
  ) {
    return "ROUTE_TO_SALES_AGENT"
  }

  if (
    has(text, /^(שלום|היי|הי|אהלן|מה\s+נשמע|מה\s+קורה|בוקר\s+טוב|ערב\s+טוב)/) ||
    has(text, /^(שלום|היי|אהלן)[\s,!?.]*$/i)
  ) {
    return "ROUTE_TO_INFO_AGENT"
  }

  if (
    has(text, /(?:איזה|מה\s+ה|רשימ(?:ת|ה)\s+)?(?:ה)?סניפ|סניפים\s+יש|לסניף|כתובות?\s+(?:ה)?סניפ/) ||
    has(text, /שעות\s+(פעילות|פתיחה)|מתי\s+פתוח/) ||
    has(text, /מדיניות|איך\s+מחזיר/) ||
    has(text, /אמצעי\s+תשלום|תשלומים|משלוח\s+חינם/)
  ) {
    return "ROUTE_TO_INFO_AGENT"
  }

  return null
}

/** Stay on current specialist unless the latest message clearly needs another agent. */
export function shouldContinueWithSpecialist(
  body: string,
  history: HistoryMessage[],
  sticky: SpecialistId
) {
  if (isCustomerServiceOpener(body)) return false
  if (isConversationClosing(body)) return false
  if (isNonSubstantiveFollowUp(body)) return false
  if (isDissatisfactionWithoutDefect(body)) return false
  if (isHumanHandoffPending(history) && !breaksPendingHandoff(body)) return true
  if (isConfirmationPending(history)) return true

  if (isProductAvailabilityQuestion(body)) return false

  if (isShippingStatusQuestion(body)) return false
  if (isFaqTopicSwitch(body) && sticky !== "faq") return false
  if (isServiceTopicSwitch(body) && sticky !== "service") return false
  if (isSalesTopicSwitch(body) && sticky !== "sales") return false

  if (sticky === "sales" && isSalesQuizContext(history, sticky)) {
    if (isCustomerServiceOpener(body)) return false
    if (isFaqTopicSwitch(body) || isServiceTopicSwitch(body)) return false
    if (isIntakeTopicPivot(body, history)) return false
    return true
  }

  if (hasOngoingSalesIntake(history)) {
    if (isIntakeTopicPivot(body, history)) return false
    if (isFaqTopicSwitch(body) || isServiceTopicSwitch(body)) return false
    return true
  }

  const route = guessMasterRoute(body)
  if (route) {
    const target = MASTER_ROUTE_MAP[route as MasterAction]
    if (target === "shipping") return false
    if (target && target !== sticky) return false
  }

  return true
}
