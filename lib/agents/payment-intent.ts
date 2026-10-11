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
