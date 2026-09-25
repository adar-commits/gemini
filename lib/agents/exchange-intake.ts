import { isInactivityAssistantMessage } from "@/lib/agents/inactivity"
import { getDissatisfactionRescueStage } from "@/lib/agents/dissatisfaction"
import {
  classifyPostPurchaseCase,
  isExchangePolicyQuestion,
  isOrderModificationRequest,
} from "@/lib/agents/inquiry-intent"
import {
  identifiedOrderNumberFromThread,
  isOrderConfirmationPending,
} from "@/lib/agents/order-lookup"
import { isValidInventorySku } from "@/lib/agents/phone-for-api"
import { CUSTOMER_HEADER, type HistoryMessage } from "@/lib/agents/types"

export type ExchangeKind = "same_model_color" | "same_model_size" | "different_model"

export type ExchangeReasonCode =
  | "changed_mind"
  | "quality_insufficient"
  | "different_from_website"

export type ExchangeIntake = {
  exchangeKind: ExchangeKind | null
  targetSku: string | null
  customerReasonText: string | null
  reasonCode: ExchangeReasonCode | null
  orderNumber: string | null
  switchRequestId: string | null
  skuQuestionSent: boolean
  skuDeclined: boolean
}

export const EXCHANGE_INTAKE_STARTED_MARKER = "נמשיך עם החלפה"
export const EXCHANGE_KIND_QUESTION_MARKER = "איזה סוג החלפה מתאים"
export const EXCHANGE_SKU_QUESTION_MARKER = "מה המק״ט של הפריט"
export const EXCHANGE_REASON_QUESTION_MARKER = "מה לא אהבתם במוצר"
export const EXCHANGE_SWITCH_CREATED_MARKER = "נפתחה בקשת החלפה"

const KIND_QUESTION_RE = /איזה\s+סוג\s+החלפה\s+מתאים/i
const SKU_QUESTION_RE = /מה\s+המק(?:״|"|')?ט\s+של\s+הפריט/i
const REASON_QUESTION_RE = /מה\s+לא\s+אהבתם\s+במוצר/i

function lastNonInactivityAssistantText(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isInactivityAssistantMessage(message.content)) continue
    return message.content
  }
  return ""
}

function assistantMessages(history: HistoryMessage[]) {
  return history.filter(
    (message) =>
      message.role === "assistant" && !isInactivityAssistantMessage(message.content)
  )
}

export function isExchangeIntakeStartedInThread(history: HistoryMessage[]) {
  return assistantMessages(history).some((message) =>
    message.content.includes(EXCHANGE_INTAKE_STARTED_MARKER)
  )
}

/** Customer chose החלפה after the two-option dissatisfaction menu. */
export function isExchangeIntakeActive(history: HistoryMessage[]) {
  if (!isExchangeIntakeStartedInThread(history)) return false
  if (getDissatisfactionRescueStage(history) === "portal_referred") return false
  return true
}

export function exchangeIntakeOrderConfirmed(history: HistoryMessage[]) {
  const orderNumber = identifiedOrderNumberFromThread(history)
  if (!orderNumber) return false
  return !isOrderConfirmationPending(history)
}

export function isExchangeOrderRequired(history: HistoryMessage[]) {
  if (!isExchangeIntakeActive(history)) return false
  return !exchangeIntakeOrderConfirmed(history)
}

function lastAssistantMatches(history: HistoryMessage[], pattern: RegExp) {
  const last = lastNonInactivityAssistantText(history)
  return pattern.test(last)
}

export function needsExchangeKindQuestion(history: HistoryMessage[]) {
  if (!isExchangeIntakeActive(history)) return false
  if (!exchangeIntakeOrderConfirmed(history)) return false
  const intake = extractExchangeIntake(history, "")
  if (intake.exchangeKind) return false
  return !assistantMessages(history).some((message) => KIND_QUESTION_RE.test(message.content))
}

export function isExchangeKindPending(history: HistoryMessage[]) {
  if (!isExchangeIntakeActive(history)) return false
  if (!exchangeIntakeOrderConfirmed(history)) return false
  const intake = extractExchangeIntake(history, "")
  if (intake.exchangeKind) return false
  return lastAssistantMatches(history, KIND_QUESTION_RE)
}

export function isExchangeSkuPending(history: HistoryMessage[]) {
  if (!isExchangeIntakeActive(history)) return false
  const intake = extractExchangeIntake(history, "")
  if (!intake.exchangeKind || intake.exchangeKind === "different_model") return false
  if (intake.targetSku || intake.skuDeclined) return false
  return lastAssistantMatches(history, SKU_QUESTION_RE)
}

export function isExchangeReasonPending(history: HistoryMessage[]) {
  if (!isExchangeIntakeActive(history)) return false
  const intake = extractExchangeIntake(history, "")
  if (intake.exchangeKind !== "different_model") return false
  if (intake.customerReasonText) return false
  return lastAssistantMatches(history, REASON_QUESTION_RE)
}

export function isDissatisfactionMenuPending(history: HistoryMessage[]) {
  return (
    getDissatisfactionRescueStage(history) === "sales_offer" &&
    !isExchangeIntakeStartedInThread(history)
  )
}

function lastAssistantOfferedExchangeChoice(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isInactivityAssistantMessage(message.content)) continue
    return (
      /\*החלפה\*/.test(message.content) ||
      /1\.\s*(?:\*החלפה\*|החלפה)/i.test(message.content) ||
      /נמשיך עם החלפה/i.test(message.content)
    )
  }
  return false
}

/** Customer chose or stated exchange execution — not return portal / not policy FAQ only. */
export function isExplicitExchangeExecutionTurn(
  body: string,
  history: HistoryMessage[] = []
) {
  const text = body.trim()
  if (!text || text.length > 220) return false
  if (isExchangePolicyQuestion(text)) return false

  if (classifyPostPurchaseCase(text) === "exchange_request") return true
  if (isOrderModificationRequest(text)) return true

  if (/^(?:החלפה|ביצוע\s+החלפה)(?:[\s,.!?]|$)/i.test(text)) {
    return (
      getDissatisfactionRescueStage(history) === "sales_offer" ||
      lastAssistantOfferedExchangeChoice(history)
    )
  }

  if (
    /^(?:כן|בטח|מעולה|אשמח|בסדר)(?:[\s,.!?]|$)/i.test(text) &&
    /(?:החלפ|להחליף|דגם\s+אחר)/i.test(text) &&
    (getDissatisfactionRescueStage(history) === "sales_offer" ||
      lastAssistantOfferedExchangeChoice(history))
  ) {
    return true
  }

  return false
}

function extractSkuFromText(text: string) {
  const match = text.match(/\b[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+\b/)
  if (!match?.[0]) return null
  return isValidInventorySku(match[0]) ? match[0] : null
}

function isSkuDeclineReply(text: string) {
  const trimmed = text.trim()
  if (!trimmed || trimmed.length > 120) return false
  return (
    /(?:לא\s+(?:יודע|מצליח|מוצא)|אין\s+לי\s+מק(?:״|"|')?ט|לא\s+בטוח)/i.test(trimmed) ||
    /(?:אין|לא)\s+(?:לי\s+)?(?:את\s+)?(?:ה)?מק(?:״|"|')?ט/i.test(trimmed)
  )
}

export function inferExchangeReasonCode(text: string): ExchangeReasonCode | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  if (
    /(?:באתר|בתמונה|בפועל|שונה\s+מ|לא\s+כמו|צבע\s+שונה|נראה\s+שונה)/i.test(trimmed)
  ) {
    return "different_from_website"
  }
  if (/(?:איכות|איכותי|לא\s+טוב\s+מספיק|נמוכ|זול|לא\s+עמיד)/i.test(trimmed)) {
    return "quality_insufficient"
  }
  if (
    /(?:לא\s+א(?:וה|ה)ב|לא\s+מתאים|התחרט|שיניתי\s+דעת|פשוט\s+לא|לא\s+בא\s+לי)/i.test(
      trimmed
    )
  ) {
    return "changed_mind"
  }
  return "changed_mind"
}

function userReplyAfterAssistantQuestion(
  history: HistoryMessage[],
  questionRe: RegExp
) {
  let questionIndex = -1
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isInactivityAssistantMessage(message.content)) continue
    if (questionRe.test(message.content)) {
      questionIndex = index
      break
    }
  }
  if (questionIndex === -1) return null

  for (let index = questionIndex + 1; index < history.length; index += 1) {
    const message = history[index]
    if (message.role === "user") return message.content.trim()
  }
  return null
}

export function extractExchangeIntake(history: HistoryMessage[], body: string): ExchangeIntake {
  const intake: ExchangeIntake = {
    exchangeKind: null,
    targetSku: null,
    customerReasonText: null,
    reasonCode: null,
    orderNumber: identifiedOrderNumberFromThread(history),
    switchRequestId: null,
    skuQuestionSent: assistantMessages(history).some((message) =>
      SKU_QUESTION_RE.test(message.content)
    ),
    skuDeclined: false,
  }

  for (const message of assistantMessages(history)) {
    const match = message.content.match(/נפתחה\s+בקשת\s+החלפה[^]*?(AB-\d+)/i)
    if (match?.[1]) intake.switchRequestId = match[1]
  }

  const kindReply =
    userReplyAfterAssistantQuestion(history, KIND_QUESTION_RE) ??
    (KIND_QUESTION_RE.test(lastNonInactivityAssistantText(history)) ? body.trim() : null)
  if (kindReply) {
    if (/(?:צבע|גוון)/i.test(kindReply) && !/(?:מידה|גודל|סייז)/i.test(kindReply)) {
      intake.exchangeKind = "same_model_color"
    } else if (/(?:מידה|גודל|סייז|shape|להגדיל|להקטין)/i.test(kindReply)) {
      intake.exchangeKind = "same_model_size"
    } else if (
      /(?:דגם\s+אחר|שטיח\s+אחר|משהו\s+אחר|לגמרי\s+אחר|מוצר\s+אחר|לא\s+א(?:וה|ה)ב)/i.test(
        kindReply
      )
    ) {
      intake.exchangeKind = "different_model"
    }
  }

  const skuReply =
    userReplyAfterAssistantQuestion(history, SKU_QUESTION_RE) ??
    (SKU_QUESTION_RE.test(lastNonInactivityAssistantText(history)) ? body.trim() : null)
  if (skuReply) {
    if (isSkuDeclineReply(skuReply)) {
      intake.skuDeclined = true
    } else {
      intake.targetSku = extractSkuFromText(skuReply)
    }
  }

  const reasonReply =
    userReplyAfterAssistantQuestion(history, REASON_QUESTION_RE) ??
    (REASON_QUESTION_RE.test(lastNonInactivityAssistantText(history)) ? body.trim() : null)
  if (reasonReply && reasonReply.length >= 3) {
    intake.customerReasonText = reasonReply
    intake.reasonCode = inferExchangeReasonCode(reasonReply)
  }

  return intake
}

export function isExchangeReadyForSwitchRequest(
  history: HistoryMessage[],
  body: string
) {
  if (!isExchangeIntakeActive(history)) return false
  if (!exchangeIntakeOrderConfirmed(history)) return false

  const intake = extractExchangeIntake(history, body)
  if (!intake.exchangeKind) return false
  if (intake.switchRequestId) return false

  if (intake.exchangeKind === "different_model") {
    return Boolean(intake.customerReasonText?.trim())
  }

  if (intake.targetSku || intake.skuDeclined) return true
  if (!intake.skuQuestionSent) return false
  return isSkuDeclineReply(body) || Boolean(extractSkuFromText(body))
}

export function buildExchangeIntakeStartReply() {
  return `${CUSTOMER_HEADER}
מעולה! ${EXCHANGE_INTAKE_STARTED_MARKER} 😊
קודם נאתר את ההזמנה — אפשר לשלוח מספר הזמנה (למשל SO26005938 או #76884), או לאשר שהיא על המספר שממנו אנחנו מתכתבים.`
}

export function buildExchangeKindQuestion() {
  return `${CUSTOMER_HEADER}
${EXCHANGE_KIND_QUESTION_MARKER}?

1. *אותו דגם, צבע אחר*
2. *אותו דגם וצבע, מידה/צורה אחרת*
3. *דגם/שטיח אחר לגמרי*`
}

export function buildExchangeSkuQuestion() {
  return `${CUSTOMER_HEADER}
${EXCHANGE_SKU_QUESTION_MARKER} שאליו תרצו להחליף? (למשל 31503138-200290)
אם אין לכם את המק״ט — אין בעיה, כתבו לי ונמשיך בכל זאת.`
}

export function buildExchangeReasonQuestion() {
  return `${CUSTOMER_HEADER}
${EXCHANGE_REASON_QUESTION_MARKER}? זה חשוב כדי שנוכל להמשיך עם בקשת ההחלפה.`
}

export function buildExchangeSwitchSuccessReply(switchRequestId: string, intake: ExchangeIntake) {
  const kindLabel =
    intake.exchangeKind === "same_model_color"
      ? "אותו דגם, צבע אחר"
      : intake.exchangeKind === "same_model_size"
        ? "אותו דגם, מידה אחרת"
        : "דגם אחר"

  return `${CUSTOMER_HEADER}
${EXCHANGE_SWITCH_CREATED_MARKER} מספר ${switchRequestId} ✅
סוג החלפה: ${kindLabel}${intake.orderNumber ? ` | הזמנה ${intake.orderNumber}` : ""}.
מעביר עכשיו ליועץ מכירות שימשיך מכאן.`
}

export function exchangeKindToApiCode(kind: ExchangeKind): "A" | "B" | "C" {
  if (kind === "same_model_color") return "A"
  if (kind === "same_model_size") return "B"
  return "C"
}
