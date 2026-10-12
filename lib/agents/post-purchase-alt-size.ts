import { isOutboundDocumentDeliveryMessage } from "@/lib/agents/digital-document-flow"
import { isDefectReplacementStatusQuestion } from "@/lib/agents/inquiry-intent"
import type { HistoryMessage } from "@/lib/agents/types"
import { CUSTOMER_HEADER } from "@/lib/agents/types"

function allUserText(history: HistoryMessage[], body: string) {
  return [
    ...history.filter((message) => message.role === "user").map((message) => message.content),
    body,
  ]
    .join("\n")
    .trim()
}

/** לשנות/להחליף כתובת is a delivery-address change, not a size or stock ask. */
export function isShippingAddressChangeAsk(
  body: string,
  history: HistoryMessage[] = []
) {
  const text = allUserText(history, body)
  return /כתובת/.test(text) && /(?:לשנות|לעדכן|להחליף)/.test(text)
}

/** Exchange because the rug does not match / they want a different model — not alt-size availability. */
function isDifferentModelExchangeDissatisfaction(text: string) {
  return /(?:לא\s+(?:דומה|כמו)|לא\s+מה\s+ש(?:רציתי|הזמנתי)|לא\s+א(?:וה|ה)ב|דגם\s+אחר|שטיח\s+אחר|ל(?:ה)?חליף\s+לדגם)/i.test(
    text
  )
}

/** Customer is asking about original packaging / opened the rug to inspect — not a size ask. */
function isExchangePackagingConcernThread(text: string) {
  return /(?:אריז(?:ה|ת)?\s*(?:ה)?מקורית|באריז(?:ה|תו)|פתח(?:תי|ת)|פתל(?:תי|ת)|איך\s+יהיה\s+באריז)/i.test(
    text
  )
}

function hasExplicitAlternateSizeAvailabilityAsk(text: string) {
  return (
    /(?:יש|קיים|זמין|אפשר\s+לקבל|יש\s+א(?:ת|ותו))[\s\S]{0,48}(?:מידה|גודל|\d\s*[x×]\s*\d|\d\s*מ(?:״|"|')?טר)/i.test(
      text
    ) ||
    /(?:האם|ה)?(?:שטיח|דגם)[\s\S]{0,60}(?:קיים|זמין|יש)[\s\S]{0,40}(?:מידה|גודל|\d\s*[x×])/i.test(
      text
    ) ||
    /(?:מידה|גודל)\s*(?:של)?\s*\d[\d\sx×]*(?:מ(?:״|"|')?טר)?/i.test(text) ||
    (/(?:גדול|קטן)\s+(?:מ(?:די|ידי)|ל(?:י|נו|הם))/i.test(text) &&
      /(?:שטיח|מידה|גודל|\d\s*מ(?:״|"|')?טר)/i.test(text))
  )
}

function hasRecentPurchaseContext(history: HistoryMessage[], text: string) {
  const purchaseFromCustomerText =
    /(?:רכשתי|הזמנתי|ההזמנה(?:\s+שלי)?|SO\d+|היום\s+ר(?:כש|כש)|ש(?:ב|)חר(?:תי)?)/i.test(
      text
    ) ||
    (/\bבהזמנה\b/i.test(text) && !/הזמנה\s+מוקדמת/i.test(text))
  if (purchaseFromCustomerText) {
    return true
  }
  return history.some(
    (message) =>
      message.role === "assistant" &&
      (isOutboundDocumentDeliveryMessage(message.content) ||
        /tracking\.carpetshop\.co\.il/i.test(message.content))
  )
}

function isSizeExchangeIntakeContext(history: HistoryMessage[], body = "") {
  if (isDefectReplacementStatusQuestion(body, history)) return false
  const text = allUserText(history, body)
  const receivedProduct =
    /(?:קיבלתי|קיבלנו|(?<![ל])הגיע(?:ה|ו)?|התקבל)/i.test(text) &&
    /(?:שטיח|פוף|מוצר|הזמנה)/i.test(text)
  if (
    (isDifferentModelExchangeDissatisfaction(text) ||
      isExchangePackagingConcernThread(text)) &&
    !hasExplicitAlternateSizeAvailabilityAsk(text)
  ) {
    return false
  }
  const sizeIssue =
    /(?:גדול|קטן)\s+(?:מ(?:די|ידי)|ל(?:י|נו|הם))|לא\s+מתאים(?:\s+ל(?:י|נו))?/i.test(text) ||
    /לא\s+יודע(?:ת|ים)?(?:\s+(?:מה|איז(?:ו|ה))\s*)?(?:ה)?(?:מידה|גודל)/i.test(text) ||
    /(?:מידה|גודל)\s+(?:ש(?:אני|צריך|מתאים)|נכון|מתאים|אחר|צריך)/i.test(text) ||
    /איז(?:ו|ה)\s+מידה\s+(?:אני|צריך|מתאים)/i.test(text)
  const sizeRelatedExchange = /(?:מידה\s+אחר(?:ת)?|גודל\s+אחר|החלפת\s+מידה)/i.test(text)
  return Boolean(receivedProduct && (sizeIssue || sizeRelatedExchange))
}

/** New purchase: site pre-order option + delivery timing — not post-purchase alt-size. */
export function isPrePurchasePreOrderSalesInquiry(
  body: string,
  history: HistoryMessage[] = []
) {
  const text = allUserText(history, body)
  if (hasRecentPurchaseContext(history, text)) return false
  return (
    /הזמנה\s+מוקדמת|מוקדמת\s+ב(?:אתר|איזור)/i.test(text) &&
    /(?:מתי|מועד|צפי|א(?:קבל|גיע))/i.test(text)
  )
}

/** Post-purchase: same model in another size — not branch SKU lookup; advisor checks the order. */
export function isPostPurchaseAlternateSizeAvailabilityQuestion(
  body: string,
  history: HistoryMessage[] = []
) {
  if (isDefectReplacementStatusQuestion(body, history)) return false
  if (isShippingAddressChangeAsk(body, history)) return false
  const text = allUserText(history, body)
  if (!hasRecentPurchaseContext(history, text)) return false
  if (
    (isDifferentModelExchangeDissatisfaction(text) ||
      isExchangePackagingConcernThread(text)) &&
    !hasExplicitAlternateSizeAvailabilityAsk(text)
  ) {
    return false
  }

  return (
    hasExplicitAlternateSizeAvailabilityAsk(text) ||
    isSizeExchangeIntakeContext(history, body)
  )
}

/** Wrong model / packaging barrier during post-purchase exchange — not alt-size availability. */
export function isPostPurchaseDifferentModelOrPackagingExchange(
  body: string,
  history: HistoryMessage[] = []
) {
  const text = allUserText(history, body)
  if (!hasRecentPurchaseContext(history, text)) return false
  return (
    (isDifferentModelExchangeDissatisfaction(text) ||
      isExchangePackagingConcernThread(text)) &&
    !hasExplicitAlternateSizeAvailabilityAsk(text)
  )
}

export function isPostPurchaseAlternateSizeThread(
  history: HistoryMessage[],
  body = ""
) {
  if (isPostPurchaseAlternateSizeAvailabilityQuestion(body, history)) return true

  const recentUser = history
    .filter((message) => message.role === "user")
    .slice(-6)
    .map((message) => message.content)
    .join("\n")
  if (!isPostPurchaseAlternateSizeAvailabilityQuestion(recentUser, history)) {
    return false
  }

  return (
    /\[media:image:/i.test(body) ||
    /(?:אין לי|תראה|בהזמנה|מה שמ(?:א|)יר)/i.test(body.trim()) ||
    /(?:מק(?:״|"|')?ט|SKU)/i.test(
      history
        .filter((message) => message.role === "assistant")
        .slice(-3)
        .map((message) => message.content)
        .join("\n")
    )
  )
}

/** Bot already explained in-branch exchange steps for a post-purchase size swap (534095173). */
export function isPostPurchaseAltSizeBranchExchangeExplained(
  history: HistoryMessage[] = []
) {
  const corpus = history.map((message) => message.content).join("\n")
  if (
    !/(?:החלפת\s+מידה|להחליף\s+מידה|מידה\s+אחר)/i.test(corpus) ||
    !hasRecentPurchaseContext(history, corpus)
  ) {
    return false
  }
  return history.some(
    (message) =>
      message.role === "assistant" &&
      /(?:בסניף\s+זה\s+ללא\s+עלות|אין\s+החלפות\s+בסניפים|בכל\s+סניף\s+בימים)/i.test(
        message.content
      )
  )
}

function hasLoggedSalesHandoffForAltSizeExchange(history: HistoryMessage[]) {
  const corpus = history.map((message) => message.content).join("\n")
  if (!/(?:החלפת\s+מידה|להחליף\s+מידה)/i.test(corpus)) return false
  return history.some(
    (message) =>
      message.role === "assistant" &&
      /(?:העבר(?:תי|נו)\s+א(?:ת|ת)\s+ה(?:שיחה|פנייה)|מעולה,\s+העברתי)[^\n]{0,80}יועץ\s+מכירות/i.test(
        message.content
      )
  )
}

/** Logistics FAQ after branch path — not a fresh sales handoff (534095173). */
export function isPostPurchaseAltSizeNewRugShipmentAsk(
  body: string,
  history: HistoryMessage[] = []
) {
  if (!isPostPurchaseAltSizeBranchExchangeExplained(history)) return false
  if (!hasLoggedSalesHandoffForAltSizeExchange(history)) return false
  const text = body.trim()
  if (!text || text.length > 160) return false
  return (
    /(?:ת)?שלח|משלוח|ישלח|תגיע/i.test(text) &&
    /(?:שטיח|מידה|המידה\s+החדש)/i.test(text)
  )
}

export function buildPostPurchaseAlternateSizeAdvisorReply(options?: {
  photoAck?: boolean
}) {
  const photoLine = options?.photoAck
    ? "תודה, קיבלתי את התמונה — "
    : ""
  return `${CUSTOMER_HEADER}
${photoLine}מבין שאתם מחפשים את אותו דגם במידה אחרת.
אני לא יכול לזהות דגם או מק״ט מתמונה, ובלי מק״ט מהמערכת אין לי בדיקת מלאי אמינה.
יועץ המכירות יוכל לבדוק מול ההזמנה שלכם אם המידה המבוקשת קיימת — להעביר ליועץ מכירות?`
}
