/** First clause wins when the customer mentions multiple issues in one message. */
export function primaryIntentText(body: string) {
  const text = body.trim()
  if (!text) return ""

  const firstLine = text.split(/\n/)[0]?.trim() ?? text
  const clause =
    firstLine.split(/\s+(?:ו(?:גם|אז|גם)|אבל|רק)\s+|\.\s+|,\s+/)[0]?.trim() ?? firstLine

  return clause || firstLine
}

export type PostPurchaseCaseKind = "defect" | "dissatisfaction" | "preorder_delay"

const DEFECT_RE =
  /פגם|פגום|פגומ(?:ה|ים|ות)|קרוע|שבור|סדוק|מקולקל|נזק|ליקוי|פגם\s+ב(?:ה)?ובלה/i

const RECEIVED_RE = /(?:קיבלתי|הגיע(?:ה|ו)?|התקבל|קיבלנו)/i
const PRODUCT_RE = /(?:שטיח|פוף|מוצר|הזמנה|תמונ(?:ה|ת)|כרית)/i

const DISSATISFACTION_RE =
  /לא\s+מרוצ|לא\s+מתאים|לא\s+אהב|לא\s+כ(?:\"|״|')?כ|אי[\s-]?שביעות\s+רצון|לא\s+מה\s+ש(?:ציפיתי|ציפינו|ציפית)/i

const MISMATCH_RE =
  /צבע.*(?:לא\s+תואם|שונה|דהוי)|(?:לא\s+תואם|שונה\s+מ|דהוי).*?(?:אתר|תמונה|צבע)|נראה\s+שונה|שונה\s+בפועל|לא\s+כמו\s+ב(?:אתר|תמונה)/i

const PREORDER_RE =
  /(?:הזמנה\s+)?מוקדמת|pre\s*-?\s*order|עיכוב.*(?:מוקדמת|מכולה)|מכולה|תלונה\s+על\s+עיכוב/i

const DELAY_RE =
  /מ(?:אחר|ש(?:ך|כה))|מעוכ(?:ב(?:ת)?|ב)|ע(?:יכוב|וכב)|לא\s+הגיע|מתי\s+יגיע|סטטוס\s+(?:ה)?(?:הגעה|משלוח)/i

function matchesDefect(text: string) {
  if (!text) return false
  if (DEFECT_RE.test(text)) {
    if (RECEIVED_RE.test(text) || PRODUCT_RE.test(text)) return true
    if (/(?:יש|קיים)\s+(?:ב(?:ו|ה|הם)?\s+)?(?:פגם|ליקוי)/i.test(text)) return true
  }
  if (
    RECEIVED_RE.test(text) &&
    /(?:יש|קיים)\s+(?:ב(?:ו|ה|הם)?\s+)?(?:פגם|ליקוי|בעיה)/i.test(text)
  ) {
    return true
  }
  return false
}

function matchesDissatisfaction(text: string) {
  if (!text || matchesDefect(text)) return false
  if (DISSATISFACTION_RE.test(text)) return true
  if (MISMATCH_RE.test(text)) return true
  if (
    RECEIVED_RE.test(text) &&
    /(?:לא\s+מרוצ|לא\s+מתאים|לא\s+אהב|לא\s+כ(?:\"|״|')?כ)/i.test(text)
  ) {
    return true
  }
  return false
}

function matchesPreorderDelay(text: string) {
  if (!text) return false
  if (PREORDER_RE.test(text) && DELAY_RE.test(text)) return true
  if (/פני(?:ה|י)\s+יזומה\s+על\s+עיכוב/i.test(text)) return true
  if (/הזמנה\s+מוקדמת/i.test(text) && DELAY_RE.test(text)) return true
  if (/מוקדמת/i.test(text) && DELAY_RE.test(text)) return true
  return false
}

/** Classify post-purchase case from primary clause, then full message. */
export function classifyPostPurchaseCase(body: string): PostPurchaseCaseKind | null {
  const primary = primaryIntentText(body)
  const candidates = [primary, body.trim()].filter(Boolean)

  for (const text of candidates) {
    if (matchesDefect(text)) return "defect"
  }
  for (const text of candidates) {
    if (matchesDissatisfaction(text)) return "dissatisfaction"
  }
  for (const text of candidates) {
    if (matchesPreorderDelay(text)) return "preorder_delay"
  }
  return null
}

export function isPreorderDelayComplaint(body: string) {
  return classifyPostPurchaseCase(body) === "preorder_delay"
}

export function isPostPurchaseDissatisfaction(body: string) {
  return classifyPostPurchaseCase(body) === "dissatisfaction"
}

export function isProductDefectComplaint(body: string) {
  return classifyPostPurchaseCase(body) === "defect"
}
