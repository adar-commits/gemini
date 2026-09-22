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

function hasRecentPurchaseContext(history: HistoryMessage[], text: string) {
  if (
    /(?:רכשתי|הזמנתי|ההזמנה(?:\s+שלי)?|בהזמנה|SO\d+|היום\s+ר(?:כש|כש)|ש(?:ב|)חר(?:תי)?)/i.test(
      text
    )
  ) {
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
  const sizeIssue =
    /(?:גדול|קטן)\s+(?:מ(?:די|ידי)|ל(?:י|נו|הם))|לא\s+מתאים(?:\s+ל(?:י|נו))?/i.test(text) ||
    /לא\s+יודע(?:ת|ים)?(?:\s+(?:מה|איז(?:ו|ה))\s*)?(?:ה)?(?:מידה|גודל)/i.test(text) ||
    /(?:מידה|גודל)\s+(?:ש(?:אני|צריך|מתאים)|נכון|מתאים|אחר|צריך)/i.test(text) ||
    /איז(?:ו|ה)\s+מידה\s+(?:אני|צריך|מתאים)/i.test(text)
  const exchangeContext = /(?:החלפ(?:ה|ת)|להחליף|מידה\s+אחר(?:ת)?|גודל\s+אחר)/i.test(text)
  return Boolean(receivedProduct && (sizeIssue || exchangeContext))
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

  const alternateSize =
    /(?:יש|קיים|זמין|אפשר\s+לקבל|יש\s+א(?:ת|ותו))[\s\S]{0,48}(?:מידה|גודל|\d\s*[x×]\s*\d|\d\s*מ(?:״|"|')?טר)/i.test(
      text
    ) ||
    /(?:האם|ה)?(?:שטיח|דגם)[\s\S]{0,60}(?:קיים|זמין|יש)[\s\S]{0,40}(?:מידה|גודל|\d\s*[x×])/i.test(
      text
    ) ||
    /(?:מידה|גודל)\s*(?:של)?\s*\d[\d\sx×]*(?:מ(?:״|"|')?טר)?/i.test(text) ||
    (/(?:גדול|קטן)\s+(?:מ(?:די|ידי)|ל(?:י|נו|הם))/i.test(text) &&
      /(?:שטיח|מידה|גודל|\d\s*מ(?:״|"|')?טר)/i.test(text))

  return alternateSize || isSizeExchangeIntakeContext(history, body)
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

export function buildPostPurchaseAlternateSizeAdvisorReply(options?: {
  photoAck?: boolean
}) {
  const photoLine = options?.photoAck
    ? "תודה, קיבלתי את התמונה — "
    : ""
  return `${CUSTOMER_HEADER}
${photoLine}מבין שאתם מחפשים את אותו דגם במידה אחרת.
אני לא יכול לזהות דגם או מק״ט מתמונה, ובלי מק״ט מהמערכת אין לי בדיקת מלאi אמינה.
יועץ המכירות יוכל לבדוק מול ההזמנה שלכם אם המידה המבוקשת קיימת — להעביר ליועץ מכירות?`
}
