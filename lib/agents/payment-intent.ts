import type { HistoryMessage } from "@/lib/agents/types"
import { isRefundTimelineQuestion } from "@/lib/agents/inquiry-intent"
import { isPostHumanHandoff } from "@/lib/agents/post-handoff"
import { isOrderCancellationSummaryLabel } from "@/lib/agents/service-intake"

const DUPLICATE_CHARGE_THREAD_RE =
  /חיוב\s+כפול|כפול.{0,48}(?:490|חיוב)|שני\s+חיובים/i

/** Open service thread about duplicate/extra card charge on an order (505729214). */
export function isOpenDuplicateChargeServiceThread(history: HistoryMessage[]) {
  return history.some(
    (message) =>
      message.role === "user" && DUPLICATE_CHARGE_THREAD_RE.test(message.content)
  )
}

function isDuplicateChargeTimelineAsk(body: string) {
  const trimmed = body.trim()
  if (!trimmed || trimmed.length > 200) return false
  if (isRefundTimelineQuestion(trimmed)) return true
  return (
    /מתי/i.test(trimmed) &&
    /(?:מחזיר|חיוב\s+כפול|הכסף|החזר)/i.test(trimmed)
  )
}

/** After prior handoff on duplicate charge — customer chases refund date (505729214). */
export function isDuplicateChargeRefundTimelineFollowUp(
  history: HistoryMessage[],
  body: string
) {
  if (!isOpenDuplicateChargeServiceThread(history)) return false
  if (!isPostHumanHandoff(null, history)) return false
  return isDuplicateChargeTimelineAsk(body)
}

const INSTALLMENT_SPLIT_CHARGE_THREAD_RE =
  /(?:2|שני|שתי)\s*תשלומים|ל(?:חלק|פצל).{0,32}תשלומים|תשלומים.{0,40}(?:חיוב|חייב)/i

/** Website checkout split into installments not reflected on card charge (534684988). */
export function isOpenInstallmentSplitChargeThread(history: HistoryMessage[]) {
  return history.some(
    (message) =>
      message.role === "user" &&
      INSTALLMENT_SPLIT_CHARGE_THREAD_RE.test(message.content)
  )
}

function isInstallmentChargeCallbackAsk(body: string) {
  const trimmed = body.trim()
  if (!trimmed || trimmed.length > 320) return false
  return (
    /(?:א(?:פשר|םשר)|יש\s+אפשרות).{0,20}(?:ל)?(?:ח(?:ז(?:ור|ר)|התקשר)|(?:ש)?(?:יחז|תחז)(?:רו|רי)?)[^\n]{0,16}אלי/i.test(
      trimmed
    ) ||
    /(?:עדיין\s+)?לא\s+חזר(?:ו|ה|ת)[^\n]{0,20}אלי/i.test(trimmed) ||
    /מחכ(?:ה|ים)[^\n]{0,32}(?:קשר|ש(?:יחז|תחז)(?:רו|רי)?)/i.test(trimmed)
  )
}

/** After handoff on installment charge — customer asks for callback / no human yet (534684988). */
export function isInstallmentChargeCallbackFollowUp(
  history: HistoryMessage[],
  body: string
) {
  if (!isOpenInstallmentSplitChargeThread(history)) return false
  if (!isPostHumanHandoff(null, history)) return false
  return isInstallmentChargeCallbackAsk(body)
}

const PAYPLUS_UNPAID_OUTREACH_RE =
  /payments\.payplus\.co\.il|הזמנ(?:ת|)ך\s+אינ(?:ה|ו)\s+עול(?:ה|ים)|טרם\s+שולמ(?:ה|ו)|התשלום\s+עוד\s+פתוח/i

const PROACTIVE_PURCHASE_CONFIRMATION_RE =
  /תודה על רכישתך בשטיח האדום|documents\.carpetshop\.co\.il|tracking\.carpetshop\.co\.il/i

/** Proactive PayPlus / חבר unpaid-payment outreach already in thread (534267975). */
export function isOpenPayplusHeverUnpaidOutreachThread(history: HistoryMessage[]) {
  return history.some(
    (message) =>
      message.role === "assistant" &&
      PAYPLUS_UNPAID_OUTREACH_RE.test(message.content)
  )
}

/** Automated receipt/tracking after unpaid outreach — payment likely completed (534267975). */
export function hasPurchaseConfirmationAfterPayplusOutreach(
  history: HistoryMessage[]
) {
  let sawOutreach = false
  for (const message of history) {
    if (
      message.role === "assistant" &&
      PAYPLUS_UNPAID_OUTREACH_RE.test(message.content)
    ) {
      sawOutreach = true
      continue
    }
    if (
      sawOutreach &&
      message.role === "assistant" &&
      PROACTIVE_PURCHASE_CONFIRMATION_RE.test(message.content)
    ) {
      return true
    }
  }
  return false
}

function isNoContactOrCheckChaseAsk(body: string) {
  const trimmed = body.trim()
  if (!trimmed || trimmed.length > 220) return false
  if (
    /(?:לא\s+י(?:צ|צ)?(?:רו|יער)|לא\s+חזר(?:ו|ה|ת))[^\n]{0,28}קשר/i.test(
      trimmed
    )
  ) {
    return true
  }
  if (
    /(?:אפשר|אשמח).{0,16}לבדוק/i.test(trimmed) &&
    /(?:הזמנ|קשר|חזר|יצר)/i.test(trimmed)
  ) {
    return true
  }
  return false
}

/** After PayPlus outreach + receipt template + prior callback handoff — chase «לא ייצרו קשר» (534267975). */
export function isPayplusPaidReceiptCallbackChaseFollowUp(
  history: HistoryMessage[],
  body: string
) {
  if (!isOpenPayplusHeverUnpaidOutreachThread(history)) return false
  if (!hasPurchaseConfirmationAfterPayplusOutreach(history)) return false
  if (!isPostHumanHandoff(null, history)) return false
  return isNoContactOrCheckChaseAsk(body)
}

/** BUYME/voucher + credit charged wrong; customer asked ביטול עסקה / redo (534268241 / 534579658). */
export function isCheckoutPaymentSplitCancelThread(
  history: HistoryMessage[],
  body = ""
) {
  const userLines = history
    .filter((message) => message.role === "user")
    .map((message) => message.content)
  const corpus = [body, ...userLines].join("\n")
  if (!/buyme|buy\s*me|ביימי/i.test(corpus)) return false
  if (
    !isOrderCancellationSummaryLabel(corpus) &&
    !/ביטול\s+עסקה|עסקה\s+מחדש/i.test(corpus)
  ) {
    return false
  }
  return /(?:אשראי|חייב|חיוב|הפרש|כרטיס|מסטר|יתרה)/i.test(corpus)
}

/** Checkout / payment with membership, gift card, or reloadable benefit card. */
export function isMembershipClubCheckoutQuestion(body: string) {
  const text = body.trim()
  if (!text || text.length > 240) return false
  return (
    /כרטיס\s+נטען|מועדון|גיפט|gift\s*card|שובר|buyme|buy\s*me|לאומי\s+בונוס|istudent|מגה\s+לאן|דולצ(?:'|׳|')?ה|דולצה/i.test(
      text
    ) ||
    /(?:להשלים|לסגור|לשלם|לפרוע).{0,40}(?:הזמנ|רכיש|קנ(?:י|י)ה|באתר)/i.test(text) ||
    /(?:באמצעות|ע(?:ם|״|")?\s*כרטיס).{0,30}(?:נטען|מועדון|חבר|פיס|buyme)/i.test(text)
  )
}
