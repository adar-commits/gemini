import {
  isSpecialistId,
  type AgentId,
  type MasterAction,
  type SpecialistId,
} from "@/lib/agents/types"

const BREAK_STICKY = new Set([
  "reset",
  "end",
  "shipping",
  "human_sales",
  "human_service",
  "invoice_tax",
  "invoice_tax_receipt",
  "receipt",
  "ROUTE_TO_SHIPPING_STATUS",
])

export function stickySpecialist(
  lastAgent: AgentId | null,
  lastAction: string | null
): SpecialistId | null {
  if (!lastAgent || !isSpecialistId(lastAgent)) return null
  if (lastAction && BREAK_STICKY.has(lastAction)) return null
  return lastAgent
}

function has(text: string, pattern: RegExp) {
  return pattern.test(text)
}

/** Obvious first-message routes. Returns null when the intent is unclear. */
export function guessMasterRoute(body: string): MasterAction | null {
  const text = body.trim()
  if (!text) return null

  if (
    has(text, /איפה\s+(ה)?משלוח(\s+שלי)?/) ||
    has(text, /סטטוס\s+(ה)?(משלוח|הזמנה)/) ||
    has(text, /מעקב\s+(אחרי\s+)?(ה)?(משלוח|חבילה|הזמנה)/) ||
    has(text, /(החבילה|ההזמנה|המשלוח)\s+שלי/) ||
    has(text, /where\s+is\s+my\s+(order|shipment|package)/i)
  ) {
    return "ROUTE_TO_SHIPPING_STATUS"
  }

  if (
    has(text, /קרוע|פגום|שבור|סדוק|תלונה/) ||
    has(text, /לא\s+קיבלתי|מוצר\s+לא\s+נכון|חסר(ים)?\s+ב/) ||
    has(text, /הגיע\s+(קרוע|פגום|שבור|לא\s+נכון)/)
  ) {
    return "ROUTE_TO_SERVICE_AGENT"
  }

  if (
    has(text, /רוצה\s+לקנות|במלאי|כמה\s+עולה|מחיר\s+של/) ||
    has(text, /הנחה|מבצע|ייעוץ\s+עיצוב|עוזר\s+לבחור/) ||
    has(text, /שטיח\s+ל(סלון|חדר|מטבח|כניסה|מרפסת)/)
  ) {
    return "ROUTE_TO_SALES_AGENT"
  }

  if (
    has(text, /שעות\s+(פעילות|פתיחה)|מתי\s+פתוח/) ||
    has(text, /מדיניות|איך\s+מחזיר|סניפ/) ||
    has(text, /אמצעי\s+תשלום|תשלומים|משלוח\s+חינם/)
  ) {
    return "ROUTE_TO_INFO_AGENT"
  }

  return null
}
