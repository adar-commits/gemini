import type { HistoryMessage } from "@/lib/agents/types"
import { CUSTOMER_HEADER } from "@/lib/agents/types"
import {
  extractRequestedModel,
  isSalesConsultationTrigger,
} from "@/lib/agents/sales-intake"

const SPECIFIC_PRODUCT_RE =
  /דגם|sku|קזבלנקה|גארדה|collection|carpetshop\.co\.il\/products|pozitiveshop\.co\.il\/products/i

const KNOWN_MODEL_RE =
  /מילאן|קזבל|גארד|sitar|linea|sydney|joy|סיטאר|positive|elite|pozitive/i

const STOCK_RE =
  /במלאי|מלאי|זמין(?:\s+ב)?(?:מלאי|חנות)?|in\s+stock|exist(?:s)?|קיים\s+ב?(?:מלאי|חנות)?/i

const LANDBOT_PRODUCT_DETAILS_RE =
  /פרטים\s+נוספים\s+לגבי\s+(?:שטיח|פוף)/i

const CONSULTATION_IN_MESSAGE_RE =
  /ייעוץ|עוזר\s+לבחור|בחיר(?:ת|ה)\s+שטיח|מתלבט/i

const HAVE_PRODUCT_RE =
  /(?:יש|יש ל(?:כם|נו)|אצל(?:כם|נו)|יש אצל(?:כם|נו))\s+(?:את\s+)?/i

const HANDOFF_LABEL_STOPWORDS =
  /^(?:בבקשה|כמה|עולה|מידה|גודל|יש|לקנות|שטיח|פוף|בגודל|במידה|אפשר|רוצה|מחפש|מסוימ(?:ת|ה)|מוצר|דגם)$/i

function hasNamedModel(text: string) {
  if (KNOWN_MODEL_RE.test(text)) return true
  if (SPECIFIC_PRODUCT_RE.test(text)) return true
  return extractRequestedModel(text) != null
}

function sanitizeHandoffLabel(label: string | null) {
  if (!label) return null
  const trimmed = label.trim().replace(/\s+/g, " ")
  if (!trimmed || trimmed.length < 2) return null
  if (HANDOFF_LABEL_STOPWORDS.test(trimmed)) return null
  if (/^(?:בבקשה|כמה\s+עולה)/i.test(trimmed)) return null
  return trimmed
}

/** Specific model, SKU, stock, or "do you have product X" — no catalog access. */
export function isProductAvailabilityQuestion(body: string) {
  const text = body.trim()
  if (!text) return false

  // General purchase / price exploration without a named model → sales intake quiz.
  if (isSalesConsultationTrigger(text) && !hasNamedModel(text)) return false

  if (LANDBOT_PRODUCT_DETAILS_RE.test(text) && !CONSULTATION_IN_MESSAGE_RE.test(text)) {
    return true
  }

  if (SPECIFIC_PRODUCT_RE.test(text) && hasNamedModel(text)) return true

  const model = extractRequestedModel(text)
  if (model) return true

  if (STOCK_RE.test(text) && hasNamedModel(text)) return true

  if (HAVE_PRODUCT_RE.test(text) && KNOWN_MODEL_RE.test(text)) return true

  return false
}

export function extractProductHandoffLabel(body: string) {
  return (
    sanitizeHandoffLabel(extractRequestedModel(body)) ||
    sanitizeHandoffLabel(body.match(/דגם\s+([^\n,.!?]+)/i)?.[1]?.trim() ?? null) ||
    (KNOWN_MODEL_RE.test(body)
      ? body.match(KNOWN_MODEL_RE)?.[0]?.trim() ?? null
      : null)
  )
}

export function isProductHandoffPending(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    return /האם להעביר את הפנייה כעת ליועץ מכירות/.test(message.content)
  }
  return false
}

export function buildProductHandoffOffer(body: string) {
  const label = extractProductHandoffLabel(body)
  const subject = label
    ? `לגבי "${label}"`
    : "לגבי מוצר או דגם ספציפי / בדיקת מלאי"
  return `${CUSTOMER_HEADER}\n${subject} — אין לי גישה ישירה לקטלוג ולמלאי.\nהאם להעביר את הפנייה כעת ליועץ מכירות ועיצוב אנושי?`
}
