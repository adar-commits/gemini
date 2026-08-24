import type { HistoryMessage } from "@/lib/agents/types"
import { CUSTOMER_HEADER } from "@/lib/agents/types"
import { extractRequestedModel } from "@/lib/agents/sales-intake"

const SPECIFIC_PRODUCT_RE =
  /דגם|sku|קזבלנקה|גארדה|collection|carpetshop\.co\.il\/products|pozitiveshop\.co\.il\/products/i

const STOCK_RE =
  /במלאי|מלאי|זמין(?:\s+ב)?(?:מלאי|חנות)?|in\s+stock|exist(?:s)?|קיים\s+ב?(?:מלאי|חנות)?/i

const HAVE_PRODUCT_RE =
  /(?:יש|יש ל(?:כם|נו)|אצל(?:כם|נו)|יש אצל(?:כם|נו))\s+(?:את\s+)?/i

/** Specific model, SKU, stock, or "do you have product X" — no catalog access. */
export function isProductAvailabilityQuestion(body: string) {
  const text = body.trim()
  if (!text) return false

  if (SPECIFIC_PRODUCT_RE.test(text)) return true
  if (extractRequestedModel(text)) return true
  if (STOCK_RE.test(text) && /שטיח|פוף|מוצר|דגם|כרית|תמונ/i.test(text)) {
    return true
  }
  if (HAVE_PRODUCT_RE.test(text) && /שטיח|פוף|מוצר|דגם|מילאן|קזבל|גארד/i.test(text)) {
    return true
  }
  return false
}

export function extractProductHandoffLabel(body: string) {
  return (
    extractRequestedModel(body) ||
    body.match(/דגם\s+([^\n,.!?]+)/i)?.[1]?.trim() ||
    body.match(/(?:יש|יש ל(?:כם|נו))\s+(?:את\s+)?([^\n,.!?]{2,40})/i)?.[1]?.trim() ||
    null
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
