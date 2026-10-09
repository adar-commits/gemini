import { DEFECT_ISSUE_REPORT_LABEL } from "@/lib/agents/service-defect-wording"
import {
  remainderAfterLeadingAffirmation,
  startsWithHandoffAffirmation,
} from "@/lib/agents/compound-reply"
import type { HistoryMessage } from "@/lib/agents/types"
import { CUSTOMER_HEADER } from "@/lib/agents/types"
import { messageAwaits } from "@/lib/agents/bot-awaiting"
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
  priorityReferenceDigitsFromOrder,
  ltrIsolateOrderNumber,
  ORDER_NUMBER_ASK_EXAMPLES,
  type OrderShipmentStatus,
} from "@/lib/agents/order-lookup"

export type ServiceIntake = {
  issueKind: PostPurchaseCaseKind | null
  /** Set only after Priority API match — never from LLM hints alone. */
  orderNumber?: string
  matchedOrder?: OrderShipmentStatus
  missingProductLabel?: string
  missingProductSku?: string
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

  if (priorityReferenceDigitsFromOrder(intake.matchedOrder)) {
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

const SERVICE_SUMMARY_INTRO = "כדי שהנציג לא יצטרך לשאול שוב, זה מה שאעביר לו:"
const SERVICE_SUMMARY_CHECK = "זה מדויק, או שחסר משהו?"
/** Current template intro + legacy "אז מסכם את הפנייה…" rows written before the rewording. */
const SERVICE_SUMMARY_PENDING_RE =
  /מסכם\s+את\s+הפנייה|שהנציג לא יצטרך לשאול שוב, זה מה שאעביר לו|זה מה ש(?:הוא יקבל|אעביר)/i

/** Bot text is the service rep-summary template (current or legacy wording). */
export function isServiceHandoffSummaryText(text: string) {
  if (SERVICE_SUMMARY_PENDING_RE.test(text)) return true
  return (
    /זה מדויק, או שחסר משהו\?/i.test(text) &&
    /(?:•|זה מה ש(?:הוא יקבל|אעביר))/i.test(text)
  )
}

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

const ORDER_CANCELLATION_SUMMARY_LABEL = "ביטול הזמנה"

/** Courier en route but address on courier side is wrong — urgent service, not FAQ address-change KB (533569676). */
export function isActiveCourierWrongAddressReport(corpus: string) {
  const text = corpus.trim()
  if (!text) return false
  if (/(?:לשנות|לעדכן|להחליף)\s+(?:את\s+)?(?:ה)?כתובת/i.test(text)) return false
  return (
    /שליח/.test(text) &&
    /כתובת/.test(text) &&
    /(?:לא\s+נכונ|שגוי|טעות|שמופיע\s+לשליח)/i.test(text)
  )
}

/** Pre-delivery cancel wording — separate from post-receipt return in rep summaries (533458767). */
export function isOrderCancellationSummaryLabel(corpus: string) {
  const text = corpus.trim()
  if (!text) return false
  const missingReceiptOnly = /לא\s+קיבל(?:נו|תי)?/i.test(text)
  if (!missingReceiptOnly && /(?:קיבל|הגיע|קיבלתי|התקבל)/i.test(text)) return false
  return /ביטול\s+(?:ה)?(?:הזמנה|עסקה)|לבטל\s+(?:את\s+)?(?:ה)?(?:הזמנה|עסקה)|רוצ(?:ה|ים)\s+(?:ל)?בטל|(?:אפשר|מותר)\s+(?:ל)?בטל(?:\s+(?:לי|אות[הו]|אותה))?/i.test(
    text
  )
}

function lastNonInactivityAssistant(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isInactivityAssistantMessage(message.content)) continue
    return message
  }
  return null
}

function isCancelShipmentStatusQuestion(text: string) {
  const last = text.trim()
  if (!last) return false
  return (
    /(?:כבר\s+(?:הגיע|נשלח)|עוד\s+לא\s+נשלח)/i.test(last) &&
    /(?:\?|או\s+ש)/i.test(last)
  )
}

function hasCancelIntentInThread(history: HistoryMessage[]) {
  return history.some((message) => {
    if (message.role !== "user") return false
    if (isOrderCancellationSummaryLabel(message.content)) return true
    return /(?:אפשר|מותר)\s+(?:ל)?בטל|(?:ל)?בטל\s*\?/i.test(message.content.trim())
  })
}

/** Bot asked shipped vs not-shipped after a cancel request — bind the next customer reply (533868148). */
export function isCancelShipmentConfirmPending(history: HistoryMessage[]) {
  if (!hasCancelIntentInThread(history)) return false
  const last = lastNonInactivityAssistant(history)
  if (!last) return false
  return isCancelShipmentStatusQuestion(last.content)
}

function isDesignerCodeRequestQuestion(text: string) {
  const body = text.replace(CUSTOMER_HEADER, "").trim()
  if (!body) return false
  return /(?:מה|איזה)\s+קוד\s*(?:ה)?מעצב/i.test(body) || /קוד\s*(?:ה)?מעצב(?:ת)?\s*\?/i.test(body)
}

/** Bot asked for designer code on an order — bind thanks-only; do not warm-close (534090339). */
export function isDesignerCodeRequestPending(history: HistoryMessage[]) {
  const last = lastNonInactivityAssistant(history)
  if (!last) return false
  return isDesignerCodeRequestQuestion(last.content)
}

export function serviceIssueSummaryLabel(intake: ServiceIntake, corpus: string) {
  if (!intake.issueKind) return "פנייה לשירות לקוחות"
  if (intake.issueKind === "return_request" && isOrderCancellationSummaryLabel(corpus)) {
    return ORDER_CANCELLATION_SUMMARY_LABEL
  }
  return ISSUE_LABELS[intake.issueKind]
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

  let customerGoal = extractCustomerGoal(corpus, issueKind)
  if (startsWithHandoffAffirmation(body.trim())) {
    const addition = remainderAfterLeadingAffirmation(body).trim()
    if (addition.length >= 3) {
      customerGoal = addition.slice(0, 120)
    }
  }

  return {
    issueKind,
    orderNumber,
    waitDuration: extractWaitDuration(corpus),
    customerGoal,
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
    lines.push(serviceIssueSummaryLabel(intake, recentUserText(history, body)))
  } else {
    lines.push("פנייה לשירות לקוחות")
  }

  if (intake.issueKind === "missing_item" && intake.missingProductLabel?.trim()) {
    const skuPart = intake.missingProductSku?.trim()
      ? ` (מק״ט ${intake.missingProductSku.trim()})`
      : ""
    lines.push(`פריט חסר: ${intake.missingProductLabel.trim()}${skuPart}`)
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
הבנתי, בקשת ההחזרה כבר פתוחה ואתם מחכים ${waitAck} שהשליח יאסוף את ${product} מהבית. מצטער על ההמתנה.

${SERVICE_SUMMARY_INTRO}
${report}

${SERVICE_SUMMARY_CHECK}`
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
    parts.push(serviceIssueSummaryLabel(intake, recentUserText(history, body)))
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
${SERVICE_SUMMARY_INTRO}
${report}

${SERVICE_SUMMARY_CHECK}`
}

export function isServiceHandoffSummaryPending(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isInactivityAssistantMessage(message.content)) continue
    return (
      messageAwaits(message, "service_summary_confirm") ||
      isServiceHandoffSummaryText(message.content)
    )
  }
  return false
}

function lastNonInactivityAssistantContent(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isInactivityAssistantMessage(message.content)) continue
    return message.content
  }
  return null
}

export function countServiceHandoffSummariesInThread(history: HistoryMessage[]) {
  let count = 0
  for (const message of history) {
    if (message.role === "assistant" && isServiceHandoffSummaryText(message.content)) {
      count += 1
    }
  }
  return count
}

/** Customer refined the case again after an updated recap — do not loop another «מדויק?». */
export function isServiceHandoffSummaryRepeatRefinement(
  body: string,
  history: HistoryMessage[]
) {
  if (!isServiceHandoffSummaryPending(history)) return false
  if (isServiceHandoffSummaryConfirmed(body, history)) return false
  if (isServiceSummaryOrderReferenceClarification(body, history)) return false
  if (
    /נקוד/u.test(body) &&
    /(?:^|\s)לא\s*(?:קשור|קשורות|קשיר)/u.test(body)
  ) {
    return false
  }
  if (countServiceHandoffSummariesInThread(history) >= 2) return true
  const lastAssistant = lastNonInactivityAssistantContent(history)
  if (!lastAssistant) return false
  return /(?:עדכנתי|עדכנת\.|הפנייה המעודכנת|עכשיו\s+זה\s+מדויק)/iu.test(
    lastAssistant
  )
}

/** Confirm+question about SO vs # mismatch after service summary — not handoff confirm. */
export function isServiceSummaryOrderReferenceClarification(
  body: string,
  history: HistoryMessage[]
) {
  if (!isServiceHandoffSummaryPending(history)) return false
  const text = body.trim()
  if (!startsWithHandoffAffirmation(text)) return false
  const remainder = remainderAfterLeadingAffirmation(text)
  if (!remainder || remainder.length < 6) return false
  if (/^(?:ו|,\s*(?:ו|להוסיף|גם))/u.test(remainder)) return false
  return (
    /\?/u.test(remainder) &&
    /(?:מס(?:פר|'׳)?\s*ה?זמנה|מס׳\s*הזמנה|SO\d|#\d{4,6}|משהו\s+אחר|שלחת.*?אחר)/iu.test(
      remainder
    )
  )
}

export function isServiceHandoffSummaryConfirmed(
  body: string,
  history?: HistoryMessage[]
) {
  const text = body.trim()
  if (history?.length && isServiceSummaryOrderReferenceClarification(body, history)) {
    return false
  }
  if (startsWithHandoffAffirmation(text)) return true
  return /^(?:נכון|בדיוק|מדויק)/i.test(text)
}

/** Customer already approved a service rep summary earlier in this thread. */
export function isServiceHandoffSummaryConfirmedInThread(history: HistoryMessage[]) {
  for (let index = 0; index < history.length - 1; index += 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (
      !messageAwaits(message, "service_summary_confirm") &&
      !isServiceHandoffSummaryText(message.content)
    ) {
      continue
    }
    const reply = history.slice(index + 1).find((next) => next.role === "user")
    if (
      reply &&
      isServiceHandoffSummaryConfirmed(reply.content, history.slice(0, index + 2))
    ) {
      return true
    }
  }
  return false
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
    Boolean(activeIntentConfirmKind(history)) ||
    isOpenServiceDefectFollowUpThread(history)
  )
}

const SERVICE_DEFECT_THREAD_RE =
  /(?:פג(?:ם|ום)|שטיח\s+פגום|בעקבות\s+(?:שטיח\s+)?פג(?:ם|ום))/i

const SERVICE_DEFECT_IN_PROGRESS_RE =
  /(?:ב(?:דיק(?:ה|ת)|ממתינ(?:ה|ים))[^\n]{0,48}בקרת\s+איכות|אשמח\s+להבין\s+איפה\s+השטיח|נמשיך\s+לטפל|פונה\s+אל(?:יך|כם)\s+בעקבות)/i

/** Open defect/quality case — intake or QC wait, not closed (507829534). */
export function isOpenServiceDefectFollowUpThread(history: HistoryMessage[]) {
  const corpus = history.map((message) => message.content).join("\n")
  if (!SERVICE_DEFECT_THREAD_RE.test(corpus)) return false
  if (isServiceHandoffSummaryPending(history)) return true
  return SERVICE_DEFECT_IN_PROGRESS_RE.test(corpus)
}
