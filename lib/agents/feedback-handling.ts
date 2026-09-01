import type { HistoryMessage } from "@/lib/agents/types"
import { CUSTOMER_HEADER } from "@/lib/agents/types"
import { isInactivityAssistantMessage } from "@/lib/agents/inactivity"
import {
  extractBranchLabelFromHistory,
  extractBranchLabelFromReviewRequest,
  isBranchReviewLinkRequest,
  isExplicitPozitiveContext,
  isWebsiteBranch,
  resolveBranchGoogleReview,
  resolveWebsiteGoogleReview,
} from "@/lib/agents/branch-google-reviews"
import {
  buildPhoneLookupDeclinedReply,
  channelPhone,
  formatDisplayPhone,
  isPhoneLookupConfirmPending,
  isPurePhoneLookupConfirmYes,
  isPhoneLookupConfirmNo,
  lookupOrdersByPhone,
  type OrderShipmentStatus,
} from "@/lib/agents/order-lookup"

export const PRAISE_FLOW_MARKER = "שמחתי לשמוע על החוויה החיובית"
export const LEGACY_PRAISE_FLOW_MARKER = "שמחנו לשמוע על החוויה החיובית"

export function isServicePraise(body: string) {
  const text = body.trim()
  if (!text || text.length > 300) return false

  return (
    /פרגון\s+ע(?:ל|ם)\s+שירות|שירות\s+(?:מעולה|טוב|נהדר|מצוין)/i.test(text) ||
    /(?:תודה|תוד(?:ה|ו)\s+רב(?:ה)?).*(?:נציג|שירות\s+טוב|שירות\s+מעולה)/i.test(text) ||
    /(?:נציג|שירות)\s+(?:מעולה|נהדר|מצוין|טוב\s+מאוד)/i.test(text) ||
    /מ(?:רוצ|רוצה)\s+(?:מ|מה)(?:נציג|שירות)/i.test(text)
  )
}

function isPraiseFlowActive(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (/השיחה אופסה/i.test(message.content)) return false
    if (isInactivityAssistantMessage(message.content)) continue
    return (
      message.content.includes(PRAISE_FLOW_MARKER) ||
      message.content.includes(LEGACY_PRAISE_FLOW_MARKER)
    )
  }
  return false
}

export function shouldHandleServicePraiseFlow(body: string, history: HistoryMessage[]) {
  if (isBranchReviewLinkRequest(body)) return false
  if (isPraiseFlowActive(history)) return true
  if (isServicePraise(body) && isPhoneLookupConfirmPending(history)) return true
  return isServicePraise(body)
}

function recentUserTexts(body: string, history: HistoryMessage[]) {
  return [
    body,
    ...history
      .filter((message) => message.role === "user")
      .slice(-6)
      .map((message) => message.content),
  ]
}

function buildPozitiveReviewDeclineReply() {
  return `${CUSTOMER_HEADER}
תודה על הרצון לדרג!
לרכישות Pozitive אין כרגע קישור ביקורת Google — אפשר לפנות לשירות בטלפון *3076.

אם צריך עוד משהו — אני כאן.`
}

function buildServicePraiseReplyForOrder(
  order: OrderShipmentStatus,
  contextTexts: string[] = []
) {
  if (isExplicitPozitiveContext(...contextTexts)) {
    return `${CUSTOMER_HEADER}
תודה רבה על המילים החמות — שמחתי לעזור!

אפשר לעזור במשהו נוסף?`
  }

  const branch = isWebsiteBranch(order.branchCode, order.branchLabel)
    ? resolveWebsiteGoogleReview()
    : resolveBranchGoogleReview(order.branchLabel, order.branchCode)

  if (!branch?.reviewUrl) {
    return `${CUSTOMER_HEADER}
תודה רבה על המילים החמות — שמחתי לעזור!

אפשר לעזור במשהו נוסף?`
  }

  const websiteNote = isWebsiteBranch(order.branchCode, order.branchLabel)
    ? "לרכישות מהאתר — "
    : ""

  return `${CUSTOMER_HEADER}
תודה רבה על המילים החמות — שמחתי לעזור!
${websiteNote}אם תרצו, אשמח לביקורת ב-Google על הסניף ב${branch.displayName}:
${branch.reviewUrl}

אפשר לעזור במשהו נוסף?`
}

function buildServicePraiseReplyForBranchLabel(
  branchLabel: string,
  contextTexts: string[] = []
) {
  if (isExplicitPozitiveContext(...contextTexts)) {
    return `${CUSTOMER_HEADER}
תודה רבה על המילים החמות — שמחתי לעזור!

אפשר לעזור במשהו נוסף?`
  }

  const branch = resolveBranchGoogleReview(branchLabel)
  if (!branch?.reviewUrl) {
    return `${CUSTOMER_HEADER}
תודה רבה על המילים החמות — שמחתי לעזור!

אפשר לעזור במשהו נוסף?`
  }

  return `${CUSTOMER_HEADER}
תודה רבה על המילים החמות — שמחתי לעזור!
אם תרצו, אשמח לביקורת ב-Google על הסניף ב${branch.displayName}:
${branch.reviewUrl}

אפשר לעזור במשהו נוסף?`
}

function buildBranchReviewLinkReplyBody(branchLabel: string, contextTexts: string[] = []) {
  if (isExplicitPozitiveContext(...contextTexts)) {
    return buildPozitiveReviewDeclineReply()
  }

  const branch =
    branchLabel && isWebsiteBranch(undefined, branchLabel)
      ? resolveWebsiteGoogleReview()
      : resolveBranchGoogleReview(branchLabel)

  if (!branch) {
    return `${CUSTOMER_HEADER}
בשמחה! על איזה סניף תרצו לדרג? (למשל: סגולה, נתניה, בני ברק, קריית אתא)`
  }

  if (!branch.reviewUrl) {
    return `${CUSTOMER_HEADER}
תודה על הרצון לדרג!
אין כרגע קישור ביקורת לסניף הזה — אפשר לפנות לשירות בטלפון *3076.

אם צריך עוד משהו — אני כאן.`
  }

  const websiteNote =
    branchLabel && isWebsiteBranch(undefined, branchLabel)
      ? "לרכישות מהאתר — "
      : ""

  return `${CUSTOMER_HEADER}
בשמחה! ${websiteNote}זה הקישור לדירוג ב-Google של הסניף ב${branch.displayName}:
${branch.reviewUrl}

אם צריך עוד משהו — אני כאן.`
}

export function buildBranchReviewLinkReply(
  body: string,
  history: HistoryMessage[] = []
) {
  const contextTexts = recentUserTexts(body, history)
  const branchLabel =
    extractBranchLabelFromReviewRequest(body) ??
    extractBranchLabelFromHistory(history)

  if (!branchLabel) {
    return buildBranchReviewLinkReplyBody("", contextTexts)
  }

  return buildBranchReviewLinkReplyBody(branchLabel, contextTexts)
}

export { isBranchReviewLinkRequest }

function buildServicePraisePhoneAsk(whatsappPhone?: string) {
  const intro = `${CUSTOMER_HEADER}
${PRAISE_FLOW_MARKER}.
תודה רבה על המילים החמות!
כדי להפנות לביקורת בסניף הנכון, נאתר קודם את ההזמנה.`

  if (whatsappPhone?.trim()) {
    return `${intro}
האם ההזמנה היא על טלפון מס׳ ${formatDisplayPhone(whatsappPhone)}?`
  }

  return `${intro}
מה מספר הטלפון שבוצעה עליו ההזמנה?`
}

export async function resolveServicePraiseReply(input: {
  body: string
  phone?: string
  history?: HistoryMessage[]
}) {
  const history = input.history ?? []
  const body = input.body.trim()
  const whatsappPhone = input.phone?.trim()

  if (isPhoneLookupConfirmPending(history) && isPraiseFlowActive(history)) {
    if (isPurePhoneLookupConfirmYes(body)) {
      const confirmed = channelPhone(whatsappPhone)
      if (!confirmed) return buildPhoneLookupDeclinedReply()
      const orders = await lookupOrdersByPhone(confirmed)
      if (orders == null) {
        return `${CUSTOMER_HEADER}
לא הצלחנו לבדוק את ההזמנה כרגע. תודה רבה על המילים החמות!`
      }
      if (orders.length === 0) {
        return `${CUSTOMER_HEADER}
לא מצאתי הזמנה לפי הטלפון. תודה רבה על המילים החמות!`
      }
      return buildServicePraiseReplyForOrder(
        orders[0]!,
        recentUserTexts(body, history)
      )
    }

    if (isPhoneLookupConfirmNo(body)) {
      return `${CUSTOMER_HEADER}
תודה רבה על המילים החמות — שמחתי לעזור!

אפשר לעזור במשהו נוסף?`
    }

    if (whatsappPhone) {
      return `${CUSTOMER_HEADER}
לא הבנתי — האם ההזמנה היא על טלפון מס׳ ${formatDisplayPhone(whatsappPhone)}?`
    }
  }

  const branchLabel = extractBranchLabelFromHistory(history)
  if (branchLabel && (isServicePraise(body) || isPraiseFlowActive(history))) {
    return buildServicePraiseReplyForBranchLabel(
      branchLabel,
      recentUserTexts(body, history)
    )
  }

  if (isServicePraise(body)) {
    return buildServicePraisePhoneAsk(whatsappPhone)
  }

  return buildServicePraisePhoneAsk(whatsappPhone)
}

/** @deprecated Use resolveServicePraiseReply */
export function buildServicePraiseReply() {
  return `${CUSTOMER_HEADER}
תודה רבה על המילים החמות — שמחתי לעזור!

אפשר לעזור במשהו נוסף?`
}

export function isWebsiteIssueComplaint(body: string) {
  const text = body.trim()
  if (!text) return false

  return (
    /תקל(?:ה|ות)\s+ב(?:אתר|אפליק)|האתר\s+לא\s+(?:עובד|נטען|נפתח)|באג\s+ב(?:אתר|אפליק)|bug/i.test(
      text
    ) ||
    /(?:לא\s+(?:מצליח|מצליחה)|אי\s+אפשר)\s+(?:ל)?(?:להזמין|לקנות|לשלם).*?(?:אתר|אונליין)/i.test(
      text
    )
  )
}

export function buildWebsiteIssueHandoffOffer() {
  return `${CUSTOMER_HEADER}
אני מבין — תקלה באתר דורשת טיפול של צוות טכני.
האם להעביר את הפנייה כעת לנציג שירות שיטפל בזה?`
}
