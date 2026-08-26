import type { HistoryMessage } from "@/lib/agents/types"
import { CUSTOMER_HEADER } from "@/lib/agents/types"
import { isConversationClosing } from "@/lib/agents/conversation-close"
import { isCustomerServiceOpener } from "@/lib/agents/customer-service-opener"
import { isProductDefectComplaint } from "@/lib/agents/inquiry-intent"
import {
  isBareSkuMessage,
  isBranchInventoryQuestion,
} from "@/lib/agents/inventory-lookup"
import { isFaqTopicSwitch, isServiceTopicSwitch } from "@/lib/agents/topic-switch"

const CONSULTATION_RE =
  /מחפש(?:ים|ת|ים)?|רוצ(?:ה|ים|ות)\s+לקנות|אפשר\s+ל(?:קנות|רכוש|הזמין)|תקציב|עד\s+[\d,]+|כמה\s+עולה|מה\s+יש|עוזר\s+לבחור|ייעוץ|מתלבט|בין\s+שני|התאמ(?:ה|ת)|גודל\s+מתאים/i

const REQUESTED_MODEL_RE =
  /(?:מחפש(?:ים|ת|ים)?\s+)?(?:לקנות\s+)?(?:שטיח|פוף)\s+([א-ת][א-תa-z0-9 \-]{1,30}?)(?=\s+ב(?:גימור|גודל)|\s+ע(?:ם|ד)|\s+ל(?:סלון|חדר|מרפס|חצר|מסדרון|גינה|מחסן|ה\b)|[\n,.!?]|$)/i

const GARBAGE_MODEL_RE =
  /^(?:בבקשה|כמה|עולה|מידה|גודל|יש|לקנות|שטיח|פוף|בגודל|במידה|אפשר|רוצה|מחפש|מסוימ(?:ת|ה)|מוצר|דגם|בבקשה\s+כמה\s+עולה)/i

const ROOM_TARGET_RE =
  /^(?:לחדר\s+ילדים|חדר\s+(?:ילדים|שינה|ילד|נוער|תינוקות)|לסלון|סלון|למסדרון|מסדרון|מטבח|מרפסת|כניסה)(?:\s|$)/i

const HEBREW_COLOR_WORD_RE =
  /^(?:כחול|אדום|ירוק|צהוב|ורוד|סגול|שחור|לבן|בז(?:'|׳)?|אפור|כתום|טורקיז|חום|בורדו|זהב|כסף|נייבי|ביי(?:ז|'|׳)?)$/i

const STYLE_DESCRIPTOR_RE =
  /^(?:יוקרתי|מודרני|כפרי|קלאסי|מינימ(?:alist)?|עכשווי|עבה|דק|חלק|מחוספס|גדול|קטן)$/i

const ROOM_PREPOSITION_IN_NAME_RE =
  /\s+ל(?:סלון|חדר|מרפס|חצר|מסדרון|גינה|מחסן|ה(?:ס|ש)(?:לון|ינה)?)\b/i

function isLikelyProductModelName(name: string) {
  const trimmed = name.trim().replace(/\s+/g, " ")
  if (!trimmed || trimmed.length < 2) return false
  if (ROOM_TARGET_RE.test(trimmed)) return false
  if (GARBAGE_MODEL_RE.test(trimmed)) return false
  if (/^(?:סלון|חדר|גדול|קטן|יוקרתי|מודרני|עבה|דק|חלק|מחוספס)/i.test(trimmed)) return false
  if (ROOM_PREPOSITION_IN_NAME_RE.test(trimmed)) return false
  if (/^(?:ו)?יש\b|פגם|ליקוי|בו\b/i.test(trimmed)) return false
  if (HEBREW_COLOR_WORD_RE.test(trimmed)) return false
  if (STYLE_DESCRIPTOR_RE.test(trimmed)) return false
  const words = trimmed.split(/\s+/)
  if (
    words.length <= 3 &&
    words.every(
      (word) => HEBREW_COLOR_WORD_RE.test(word) || STYLE_DESCRIPTOR_RE.test(word)
    )
  ) {
    return false
  }
  return true
}

const PRODUCT_SEARCH_FAILURE_RE =
  /לא\s+מוצא(?:ת|תי|ים)?(?:\s+(?:משהו|כלום|באתר|שם|דבר))?|לא\s+מצא(?:ת|תי|ים)?(?:\s+(?:משהו|באתר|שם|דבר))?|אין\s+(?:לי\s+)?(?:ב)?(?:אתר|קישור)|קשה\s+(?:ל)?(?:מצוא|חפש)|(?:תוכל|אפשר)\s+(?:לי\s+)?(?:ל)?(?:עזור\s+(?:לי\s+)?(?:ל)?מצוא|מצוא).*?(?:שטיח|מוצר|דגם)/i

function isSalesConsultationTrigger(text: string) {
  return CONSULTATION_RE.test(text.trim())
}

export function extractRequestedModel(text: string): string | null {
  const match = text.trim().match(REQUESTED_MODEL_RE)
  if (!match) return null
  const name = match[1].trim().split(/\n/)[0].trim().replace(/\s+/g, " ")
  if (!isLikelyProductModelName(name)) return null
  return name
}

/** Customer couldn't find a product on the site or asks for help locating one. */
export function isProductSearchFailure(body: string) {
  const text = body.trim()
  if (!text || isFaqTopicSwitch(text)) return false
  return PRODUCT_SEARCH_FAILURE_RE.test(text)
}

const SPECIFIC_PRODUCT_RE =
  /דגם|sku|קזבלנקה|גארדה|collection|carpetshop\.co\.il\/products|pozitiveshop\.co\.il\/products/i

const KNOWN_MODEL_RE =
  /מילאן|קזבל|גארד|sitar|linea|sydney|joy|סיטאר|positive|elite|pozitive/i

const PRODUCT_URL_RE =
  /https?:\/\/(?:www\.)?(?:carpetshop|pozitiveshop)\.co\.il\/products\/[^\s]+/i

const STOCK_RE =
  /במלאי|מלאי|זמין(?:\s+ב)?(?:מלאי|חנות)?|in\s+stock|exist(?:s)?|קיים\s+ב?(?:מלאי|חנות)?/i

const INVENTORY_COMMERCIAL_RE =
  /כמה\s+עולה|מה\s+המחיר|מחיר\s+של|ב(?:גודל|מידה)\s+\d|גודל\s+\d|מידה\s+\d|יש\s+(?:לכם|במלאי)|זמין\s+(?:ב)?(?:מידה|גודל)|קיים\s+ב(?:מידה|גודל)|האם\s+יש/i

const LANDBOT_PRODUCT_DETAILS_RE =
  /פרטים\s+נוספים\s+לגבי\s+(?:שטיח|פוף)/i

const CONSULTATION_IN_MESSAGE_RE =
  /ייעוץ|עוזר\s+לבחור|בחיר(?:ת|ה)\s+שטיח|מתלבט/i

const HAVE_PRODUCT_RE =
  /(?:יש\s+(?:ל(?:כם|נו)|במלאי)|יש\s+אצל(?:כם|נו)|אצל(?:כם|נו))\s*(?:את\s+)?/i

const URL_REQUEST_MARKER_RE =
  /קישור לדף המוצר|קישור למוצר מהאתר|שלח(?:\/|)?(?:ו|י)?\s*קישור/i

function hasNamedModel(text: string) {
  if (KNOWN_MODEL_RE.test(text)) return true
  if (SPECIFIC_PRODUCT_RE.test(text) && !/שעות|סניפ|מדיניות/i.test(text)) return true
  return extractRequestedModel(text) != null
}

function hasSpecificProductContext(text: string) {
  return (
    hasNamedModel(text) ||
    hasProductUrl(text) ||
    (LANDBOT_PRODUCT_DETAILS_RE.test(text) && !CONSULTATION_IN_MESSAGE_RE.test(text))
  )
}

export function extractProductUrl(text: string): string | null {
  return text.match(PRODUCT_URL_RE)?.[0] ?? null
}

export function hasProductUrl(text: string) {
  return extractProductUrl(text) != null
}

/** Stock, price, size availability, or "do you have X" for a known product. */
export function isProductInventoryQuestion(body: string) {
  const text = body.trim()
  if (!text || isFaqTopicSwitch(text)) return false
  if (isServiceTopicSwitch(text) || isProductDefectComplaint(text)) return false
  if (isBranchInventoryQuestion(text) || isBareSkuMessage(text)) return false
  if (!hasSpecificProductContext(text)) return false
  if (isSalesConsultationTrigger(text) && !hasNamedModel(text) && !hasProductUrl(text)) {
    return false
  }

  return (
    STOCK_RE.test(text) ||
    INVENTORY_COMMERCIAL_RE.test(text) ||
    (HAVE_PRODUCT_RE.test(text) && hasNamedModel(text))
  )
}

/** Customer named or linked a specific product — not general carpet exploration. */
export function isSpecificProductMention(body: string) {
  const text = body.trim()
  if (!text || isFaqTopicSwitch(text)) return false
  if (isBranchInventoryQuestion(text) || isBareSkuMessage(text)) return false
  if (isProductInventoryQuestion(text)) return false
  if (isSalesConsultationTrigger(text) && !hasNamedModel(text) && !hasProductUrl(text)) {
    return false
  }
  return hasSpecificProductContext(text)
}

/** Either inventory/commercial or a specific product thread — breaks sales quiz sticky. */
export function isProductAvailabilityQuestion(body: string) {
  return (
    isBranchInventoryQuestion(body) ||
    isBareSkuMessage(body) ||
    isProductInventoryQuestion(body) ||
    isSpecificProductMention(body)
  )
}

export function isProductUrlRequestPending(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    return URL_REQUEST_MARKER_RE.test(message.content)
  }
  return false
}

export function isProductHandoffPending(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    return /האם להעביר את הפנייה כעת ליועץ מכירות/.test(message.content)
  }
  return false
}

/** Ask for a product page link — never quote the customer's words back. */
export function buildProductUrlRequest() {
  return `${CUSTOMER_HEADER}
כדי שאוכל לעזור בצורה מדויקת, אשמח לקבל קישור לדף המוצר מהאתר (carpetshop.co.il או pozitiveshop.co.il).`
}

export function buildProductUrlReminder() {
  return `${CUSTOMER_HEADER}
כשיהיה לך קישור לדף המוצר מהאתר — שלח ואמשיך משם.`
}

/** Customer replied after we asked for a product URL — accept URL, model name, or any substantive text. */
export function acceptsAsProductReference(body: string) {
  const text = body.trim()
  if (!text || text.length < 2) return false
  if (isCustomerServiceOpener(text)) return false
  if (isConversationClosing(text)) return false
  if (isFaqTopicSwitch(text) || isServiceTopicSwitch(text)) return false
  if (/^(?:כן|לא)(?:[\s,.!?]|$)/i.test(text) && text.length < 10) return false
  return true
}

/** After receiving a product URL or any accepted product reference — offer human handoff. */
export function buildProductHandoffAfterReference(_body: string) {
  return `${CUSTOMER_HEADER}
קיבלתי, תודה.
אין לי גישה ישירה לקטלוג ולמלאי — יועץ המכירות יוכל לעזור עם פרטים, מחירים וזמינות.
האם להעביר את הפנייה כעת ליועץ מכירות ועיצוב אנושי?`
}

/** @deprecated Use buildProductHandoffAfterReference */
export function buildProductHandoffAfterUrl(body: string) {
  return buildProductHandoffAfterReference(body)
}

/** Stock / price / availability — apologize and offer human; never quote customer text. */
export function buildProductInventoryHandoff() {
  return `${CUSTOMER_HEADER}
מצטער, אין לי גישה ישירה לקטלוג, מחירים או מלאי.
האם להעביר את הפנייה כעת ליועץ מכירות ועיצוב אנושי?`
}

/** @deprecated Use buildProductInventoryHandoff or buildProductHandoffAfterUrl */
export function buildProductHandoffOffer(body: string) {
  if (hasProductUrl(body)) return buildProductHandoffAfterUrl(body)
  if (isProductInventoryQuestion(body)) return buildProductInventoryHandoff()
  return buildProductUrlRequest()
}
