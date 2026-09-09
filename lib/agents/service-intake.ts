import { DEFECT_ISSUE_REPORT_LABEL } from "@/lib/agents/service-defect-wording"
import type { HistoryMessage } from "@/lib/agents/types"
import { CUSTOMER_HEADER } from "@/lib/agents/types"
import {
  classifyPostPurchaseCase,
  type PostPurchaseCaseKind,
  isActiveReturnExchangePickupCase,
} from "@/lib/agents/inquiry-intent"
import {
  activeIntentConfirmKind,
  isPostPurchaseIntentConfirmPending,
} from "@/lib/agents/intent-confirmation"
import { isInactivityAssistantMessage } from "@/lib/agents/inactivity"
import {
  customerOrderNumberStyleFromHistory,
  extractOrderNumber,
  formatCustomerOrderNumber,
  formatCustomerOrderNumberForThread,
  isWebsiteOrderRow,
  ltrIsolateOrderNumber,
  ORDER_NUMBER_ASK_EXAMPLES,
  type OrderShipmentStatus,
} from "@/lib/agents/order-lookup"

export type ServiceIntake = {
  issueKind: PostPurchaseCaseKind | null
  /** Set only after Priority API match — never from LLM hints alone. */
  orderNumber?: string
  matchedOrder?: OrderShipmentStatus
  waitDuration?: string
  customerGoal?: string
}

function formatServiceReportOrderLabel(
  intake: ServiceIntake,
  history: HistoryMessage[],
  body: string
) {
  if (!intake.orderNumber || !intake.matchedOrder) return null

  const style = customerOrderNumberStyleFromHistory(history, body)
  if (style) {
    return formatCustomerOrderNumberForThread(
      intake.orderNumber,
      history,
      body,
      intake.matchedOrder
    )
  }

  if (isWebsiteOrderRow(intake.matchedOrder.raw)) {
    return ltrIsolateOrderNumber(
      formatCustomerOrderNumber({
        orderNumber: intake.orderNumber,
        style: "hash",
        order: intake.matchedOrder,
        history,
        body,
      })
    )
  }

  return formatCustomerOrderNumberForThread(
    intake.orderNumber,
    history,
    body,
    intake.matchedOrder
  )
}

const SERVICE_SUMMARY_PENDING_RE =
  /(?:אז\s+)?(?:לסיכום|מסכם\s+את\s+הפנייה)|האם\s+ז(?:ה|ו)\s+נכון\s+עד\s+כה|אני\s+צודק\s*\?/i

const WAIT_DURATION_RE =
  /(?:כבר|מ(?:זה|על)?|במשך|כ(?:\"|״|')?ל)\s*(?:כ)?(?:\"|״|')?(?:שבוע(?:יים|יים|)?|יום(?:יים|)?|חודש(?:יים|)?|\d+\s+(?:ימים|שבועות|חודשים))|(?:שבוע(?:יים|יים|)|יום(?:יים|)?)\s+(?:ש(?:אני|אנחנו)|(?:ש)?(?:מ)?(?:חכ(?:ה|ים|ות)|ממתינ(?:ה|ים|ות)?))/i

const CUSTOMER_GOAL_RE =
  /(?:רוצ(?:ה|ים|ות)|(?:מ)?(?:חכ(?:ה|ים|ות)|ממתינ(?:ה|ים|ות)?)|(?:מ)?(?:צ(?:ריך|ריכ(?:ה|ים|ות)?|פ(?:ה|ים|ות)?))|(?:מ)?(?:בקש(?:ה|ת)?|מעונ(?:יין|יינ(?:ת|ים|ות)?)))\s*(?:ל)?(?:ש)?(?:יאספ(?:ו|u)|(?:ל)?(?:איסוף|לאסוף)|(?:ל)?(?:דעת|עדכון|סטטוס|לזרז|לזרז\s+א(?:ת|ת)?)|(?:ש)?(?:נציג|יועץ))/i

const ISSUE_LABELS: Record<PostPurchaseCaseKind, string> = {
  return_pickup_pending:
    "בקשת החזרה כבר הוגשה — ממתינים לאיסוף שליח מהבית (לפני זיכוי)",
  return_request: "בקשת החזרה",
  exchange_request: "בקשת החלפה",
  defect: DEFECT_ISSUE_REPORT_LABEL,
  dissatisfaction: "אי-שביעות רצון מהמוצר",
  missing_item: "פריט חסר בהזמנה",
  preorder_delay: "עיכוב בהזמנה מוקדמת",
}

function recentUserText(history: HistoryMessage[], body: string) {
  const parts = history
    .filter((message) => message.role === "user")
    .slice(-6)
    .map((message) => message.content.trim())
  parts.push(body.trim())
  return parts.filter(Boolean).join("\n")
}

function extractWaitDuration(text: string) {
  const weekMatch = text.match(/(?:כבר\s+)?(?:כל\s+)?שבוע(?:יים|יים|)?/i)
  if (weekMatch) return weekMatch[0].trim().slice(0, 60)

  const dayMatch = text.match(/(?:כבר\s+)?(?:יום(?:יים|)?|\d+\s+ימים)/i)
  if (dayMatch) return dayMatch[0].trim().slice(0, 60)

  const match = text.match(WAIT_DURATION_RE)
  return match?.[0]?.trim().slice(0, 60)
}

function extractCustomerGoal(text: string, kind: PostPurchaseCaseKind | null) {
  if (kind === "return_pickup_pending") {
    if (/(?:ל)?(?:זרז|לזרז)/i.test(text)) return "לזרז את האיסוף / לקבל עדכון"
    if (/(?:סטטוס|עדכון|מה\s+(?:קורה|המצב))/i.test(text)) {
      return "עדכון על סטטוס האיסוף"
    }
    return "לתאם / לזרז איסוף מהבית לצורך החזרה"
  }

  const match = text.match(CUSTOMER_GOAL_RE)
  if (match) return match[0].trim().slice(0, 80)
  return undefined
}

function resolveIssueKind(history: HistoryMessage[], body: string): PostPurchaseCaseKind | null {
  return (
    activeIntentConfirmKind(history) ??
    classifyPostPurchaseCase(body) ??
    classifyPostPurchaseCase(recentUserText(history, ""))
  )
}

export function extractServiceIntake(
  history: HistoryMessage[],
  body: string
): ServiceIntake {
  const corpus = recentUserText(history, body)
  const issueKind = resolveIssueKind(history, body)
  const orderNumber =
    extractOrderNumber(body) ??
    extractOrderNumber(corpus) ??
    undefined

  return {
    issueKind,
    orderNumber,
    waitDuration: extractWaitDuration(corpus),
    customerGoal: extractCustomerGoal(corpus, issueKind),
  }
}

export function needsServiceSummaryConfirm(intake: ServiceIntake) {
  if (!intake.issueKind) return true
  if (intake.issueKind === "return_pickup_pending") return true
  return false
}

/** Last-resort when the main pipeline timed out or returned empty — known pickup-wait openings. */
export function salvageReturnPickupAwaitingReply(body: string) {
  const trimmed = body.trim()
  if (!trimmed) return null
  if (
    classifyPostPurchaseCase(trimmed) !== "return_pickup_pending" &&
    !isActiveReturnExchangePickupCase(trimmed)
  ) {
    return null
  }

  const intake = extractServiceIntake([], trimmed)
  intake.issueKind = "return_pickup_pending"
  return buildReturnPickupAwaitingServiceReply(intake, trimmed)
}

export function isReturnPickupAwaitingThread(
  history: HistoryMessage[],
  body: string
) {
  const userTexts = history
    .filter((message) => message.role === "user")
    .slice(-6)
    .map((message) => message.content)
  userTexts.push(body)

  return userTexts.some(
    (text) =>
      classifyPostPurchaseCase(text) === "return_pickup_pending" ||
      isActiveReturnExchangePickupCase(text)
  )
}

function pickupProductPhrase(body: string) {
  if (/שטיח/i.test(body)) return "השטיח"
  if (/פוף/i.test(body)) return "הפוף"
  return "המוצר"
}

function pickupProductLabel(body: string) {
  if (/שטיח/i.test(body)) return "שטיח"
  if (/פוף/i.test(body)) return "פוף"
  return "מוצר"
}

function returnPickupWaitAck(intake: ServiceIntake) {
  if (!intake.waitDuration) return "כבר זמן רב"
  const duration = intake.waitDuration.replace(/^כבר\s*/i, "").trim()
  return duration ? `כבר ${duration}` : "כבר זמן רב"
}

function returnPickupGoalReportLine(intake: ServiceIntake, body: string) {
  const corpus = `${body}\n${intake.customerGoal ?? ""}`
  if (/(?:ל)?(?:זרז|לזרז)/i.test(corpus)) {
    return "הלקוח פנה לברר סטטוס איסוף / לזרז את האיסוף כדי להתקדם עם ההחזרה"
  }
  if (/(?:סטטוס|עדכון|מה\s+(?:קורה|המצב))/i.test(corpus)) {
    return "הלקוח פנה לברר סטטוס איסוף של המוצר כדי להתקדם עם ההחזרה"
  }
  return "הלקוח ממתין לאיסוף מהבית ומבקש סיוע מהשירות להתקדם עם ההחזרה"
}

/** Customer-visible rep report — bullet lines for service handoff. */
export function buildServiceHandoffReportBlock(
  intake: ServiceIntake,
  body = "",
  history: HistoryMessage[] = []
) {
  const lines: string[] = []
  const product = pickupProductLabel(body)

  const orderLabel = formatServiceReportOrderLabel(intake, history, body)
  if (orderLabel) {
    lines.push(`מס׳ הזמנה: ${orderLabel}`)
  }

  if (intake.issueKind === "return_pickup_pending") {
    lines.push(`הלקוח ביקש להחזיר ${product} בהזמנה ונפתחה בקשת החזרה`)
    lines.push("נוצרה בקשת איסוף לחברת השליחויות")
    lines.push(returnPickupGoalReportLine(intake, body))
    return lines.map((line) => `• ${line}`).join("\n")
  }

  if (intake.issueKind) {
    lines.push(ISSUE_LABELS[intake.issueKind])
  } else {
    lines.push("פנייה לשירות לקוחות")
  }

  if (intake.waitDuration) {
    lines.push(`משך ההמתנה: ${intake.waitDuration.replace(/^כבר\s*/i, "").trim()}`)
  }

  if (intake.customerGoal) {
    lines.push(`מטרת הפנייה: ${intake.customerGoal}`)
  }

  return lines.map((line) => `• ${line}`).join("\n")
}

/** Awaiting courier pickup after return was already filed — rep report + confirm, not shipping status. */
export function buildReturnPickupAwaitingServiceReply(
  intake: ServiceIntake,
  body: string,
  history: HistoryMessage[] = []
) {
  const product = pickupProductPhrase(body)
  const waitAck = returnPickupWaitAck(intake)
  const report = buildServiceHandoffReportBlock(intake, body, history)

  return `${CUSTOMER_HEADER}
הבנתי שכבר פתחתם בקשת החזרה וממתינים שהשליח יגיע לאסוף את ${product} מהבית ${waitAck}.

אז מסכם את הפנייה שלכם עבור נציג שירות הלקוחות שלנו:
${report}

אני צודק?`
}

/** Service cases that may still need order ID before handoff (not return-pickup-wait). */
export function buildServiceOrderIdPrompt() {
  return `${CUSTOMER_HEADER}
קיבלתי, מצטער על ההמתנה. כדי שאוכל לבדוק את הסטטוס עבורך — יש לך במקרה מספר ההזמנה? ${ORDER_NUMBER_ASK_EXAMPLES}
אם לא, אני יכול לנסות לאתר לפי הטלפון שממנו אנחנו מתכתבים כעת.`
}

export function buildServiceHandoffSummary(
  intake: ServiceIntake,
  history: HistoryMessage[] = [],
  body = ""
) {
  const parts: string[] = []

  const orderLabel = formatServiceReportOrderLabel(intake, history, body)
  if (orderLabel) {
    parts.push(`הזמנה ${orderLabel}`)
  }

  if (intake.issueKind) {
    parts.push(ISSUE_LABELS[intake.issueKind])
  } else {
    parts.push("פנייה לשירות")
  }

  if (intake.waitDuration) {
    parts.push(`ממתינים ${intake.waitDuration}`)
  }

  if (intake.customerGoal) {
    parts.push(`מבקשים: ${intake.customerGoal}`)
  }

  return parts.join(" · ")
}

export function buildServiceHandoffConfirmReply(
  intake: ServiceIntake,
  body = "",
  history: HistoryMessage[] = []
) {
  const report = buildServiceHandoffReportBlock(intake, body, history)
  return `${CUSTOMER_HEADER}
אז מסכם את הפנייה שלכם עבור נציג שירות הלקוחות שלנו:
${report}

אני צודק?`
}

export function isServiceHandoffSummaryPending(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isInactivityAssistantMessage(message.content)) continue
    return SERVICE_SUMMARY_PENDING_RE.test(message.content)
  }
  return false
}

export function isServiceHandoffSummaryConfirmed(body: string) {
  return /^(?:כן|נכון|בדיוק|מדויק|yes)/i.test(body.trim())
}

/** Internal note for the service rep — same facts, compact one-liner. */
export function buildServiceRepHandoffNote(intake: ServiceIntake) {
  return `[שירות] ${buildServiceHandoffSummary(intake)}`
}

/** Compact handoff note for customer-visible transfer replies after confirm. */
export function buildServiceRepGoalNote(intake: ServiceIntake) {
  const goal = intake.customerGoal?.trim()
  if (goal) return `[שירות] מבקשים: ${goal}`
  return "[שירות] מבקשים: המשך טיפול שירות"
}

export function isPostPurchaseServiceFlow(history: HistoryMessage[]) {
  return (
    isPostPurchaseIntentConfirmPending(history) ||
    isServiceHandoffSummaryPending(history) ||
    Boolean(activeIntentConfirmKind(history))
  )
}
