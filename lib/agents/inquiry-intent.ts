/** First clause wins when the customer mentions multiple issues in one message. */
export function primaryIntentText(body: string) {
  const text = body.trim()
  if (!text) return ""

  const firstLine = text.split(/\n/)[0]?.trim() ?? text
  const clause =
    firstLine.split(/\s+(?:ו(?:גם|אז|גם)|אבל|רק)\s+|\.\s+|,\s+/)[0]?.trim() ?? firstLine

  return clause || firstLine
}

export type PostPurchaseCaseKind =
  | "defect"
  | "dissatisfaction"
  | "preorder_delay"
  | "return_request"
  | "missing_item"

const RETURN_INTENT_RE =
  /(?:רוצ(?:ה|ים|ות)|(?:מ)?(?:עונ(?:ה|ים|ת)?|בקש(?:ה|ת)?))\s*(?:ל)?(?:ה)?(?:חזיר|החזר)|(?:ל)?החזיר(?:\s+א(?:ת|ת)?|\s+אות(?:ו|ה|ם)?)|(?:ב(?:ק|ק)ש(?:ה|ת)?\s+)?(?:ה)?החזר(?:ה|ות)?(?:\s|$)/i

const DEFECT_RE =
  /פגם|פגום|פגומ(?:ה|ים|ות)|קרוע|שבור|סדוק|מקולקל|נזק|ליקוי|פגם\s+ב(?:ה)?ובלה/i

const SOFT_PROBLEM_RE =
  /כתם|כתמים|ריח|רטוב|דהוי|לא\s+תקין|לא\s+בסדר|מוזר|יש\s+בעיה|משהו\s+לא\s+כ(?:\"|״|')?כ/i

const RECEIVED_RE = /(?:קיבלתי|הגיע(?:ה|ו)?|התקבל|קיבלנו)/i
const PRODUCT_RE = /(?:שטיח|פוף|מוצר|הזמנה|תמונ(?:ה|ת)|כרית)/i

const DISSATISFACTION_RE =
  /לא\s+(?:ממש\s+|כל\s+כ(?:\"|״|')?ך\s+|מ(?:די)?\s+)?(?:מרוצ|מתאים|א(?:וה|ה)ב(?:ת|ים|ות|ו)?|כ(?:\"|״|')?כ)|לא\s+א(?:וה|ה)ב\s+א(?:ת(?:ו|ה|ם)?|ה(?:שטיח|מוצר)|אות(?:ו|ה))|אי[\s-]?שביעות\s+רצון|לא\s+מה\s+ש(?:ציפיתי|ציפינו|ציפית)|(?:ל)?צער(?:י|נו)\s+(?:ש)?(?:אני|אנחנו)?\s*לא/i

const MISMATCH_RE =
  /צבע.*(?:לא\s+תואם|שונה|דהוי)|(?:לא\s+תואם|שונה\s+מ|דהוי).*?(?:אתר|תמונה|צבע)|נראה\s+שונה|שונה\s+בפועל|לא\s+כמו\s+ב(?:אתר|תמונה)/i

const PREORDER_RE =
  /(?:הזמנה\s+)?מוקדמת|pre\s*-?\s*order|עיכוב.*(?:מוקדמת|מכולה)|מכולה|תלונה\s+על\s+עיכוב/i

const DELAY_RE =
  /מ(?:אחר|ש(?:ך|כה))|מעוכ(?:ב(?:ת)?|ב)|ע(?:יכוב|וכב)|לא\s+הגיע|מתי\s+יגיע|סטטוס\s+(?:ה)?(?:הגעה|משלוח)/i

function matchesReceivedWithProblem(text: string) {
  if (!RECEIVED_RE.test(text)) return false
  if (DEFECT_RE.test(text) || SOFT_PROBLEM_RE.test(text)) return true
  if (/(?:יש|קיים)\s+(?:ב(?:ו|ה|הם)?\s+)?(?:פגם|ליקוי|בעיה)/i.test(text)) return true
  if (/(?:אבל|ויש|וזה|עם).{0,40}(?:בעיה|לא\s+תקין|לא\s+בסדר|מוזר|כתם|ריח|חסר|לא\s+נכון)/i.test(text)) {
    return true
  }
  return false
}

/** Customer wants to execute a return — not "how does return policy work?" */
export function mentionsReturnIntent(text: string) {
  return RETURN_INTENT_RE.test(text.trim())
}

const FUTURE_PURCHASE_RE =
  /(?:אחר(?:י)?\s+ש(?:א)?|לפני\s+(?:ש(?:א)?)?|כש(?:א)?|בעתיד|אם\s+(?:א)?(?:קנ|רכ)|(?:א|)?(?:קנ(?:ה|ו|יתי)?|רכ(?:ש|יב)(?:ה|תי|ו)?)|(?:א|)?(?:רצ(?:ה|ו|ית)?|תרצ(?:ה|ו|ית)?)\s+(?:ל)?(?:קנ|רכ))/i

/** Policy / hypothetical return question — not an active return request. */
export function isReturnPolicyQuestion(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return false

  if (
    /(?:איך|מה\s+(?:ה)?(?:דרך|מדיניות)|מדיניות\s+(?:ה)?החזר)/i.test(trimmed) &&
    !RECEIVED_RE.test(trimmed)
  ) {
    return true
  }

  if (
    /(?:מה\s+(?:י)?קרה|what\s+if|ואם|אם\s+(?:א)?(?:רצ(?:ה|ו|ית)?|תרצ(?:ה|ו|ית)?)).*(?:החזיר|החזר|החלפ|ביטול|תחרט)/i.test(
      trimmed
    )
  ) {
    return true
  }

  if (
    /(?:החזיר|החזר|החלפ|ביטול).*(?:אחר(?:י)?|לפני|כש|אם|בעתיד)/i.test(trimmed) &&
    FUTURE_PURCHASE_RE.test(trimmed)
  ) {
    return true
  }

  if (
    /(?:רק\s+)?(?:שאל(?:תי|ה)|רצ(?:יתי|ה)\s+(?:ל)?(?:דעת|לשאול)|בירור|לידע)/i.test(trimmed) &&
    /(?:החזיר|החזר|החלפ|ביטול)/i.test(trimmed)
  ) {
    return true
  }

  if (isReturnFlowCorrection(trimmed)) return true

  if (FUTURE_PURCHASE_RE.test(trimmed) && mentionsReturnIntent(trimmed) && !RECEIVED_RE.test(trimmed)) {
    return true
  }

  if (
    mentionsReturnIntent(trimmed) &&
    /(?:מה\s+(?:ה)?(?:אפשרויות|אופציות)|איך\s+(?:אפשר|מ)?(?:ה)?(?:חזיר|ל(?:ה)?החזיר)|מה\s+(?:ה)?(?:מדיניות|תהליך|דרך)|מה\s+(?:ה)?(?:אפשר|מותר))/i.test(
      trimmed
    )
  ) {
    return true
  }

  return false
}

/** Customer clarifies they are not executing a return — pivot back to FAQ. */
export function isReturnFlowCorrection(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return false
  return (
    /(?:לא\s+(?:רוצ(?:ה|ים|ות)|בא(?:מת)?)|רק\s+שאל|זו\s+ה(?:ייתה|יתה)\s+שאלה|לא\s+מ(?:בקש|עונ(?:ה|ים|ת)))/i.test(
      trimmed
    ) && /(?:החזיר|החזר|החלפ|ביטול)/i.test(trimmed)
  )
}

function matchesReturnRequest(text: string) {
  if (!text || isReturnPolicyQuestion(text) || isReturnFlowCorrection(text)) return false
  if (!mentionsReturnIntent(text)) return false
  if (FUTURE_PURCHASE_RE.test(text) && !RECEIVED_RE.test(text)) return false
  // Explicit execution after policy — not a general "what are my options?" ask.
  if (/^(?:החזרה|ביצוע\s+החזרה)(?:[\s,.!?]|$)/i.test(text.trim())) return true
  return false
}

function matchesDefect(text: string) {
  if (!text) return false
  if (matchesReceivedWithProblem(text)) return true
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
    /(?:לא\s+(?:ממש|כל\s+כך|מ(?:די)?)\s+)?(?:מרוצ|מתאים|א(?:וה|ה)ב(?:ת|ים|ות|ו)?|כ(?:\"|״|')?כ)|לא\s+אוהב\s+א/i.test(
      text
    )
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

const MISSING_ITEM_RE =
  /(?:קיבלתי|הגיע(?:ה|ו)?)\s+רק|רק\s+(?:אח(?:ת|ד)|חלק|ח(?:מ)?יש(?:ה|ית)?)|(?:\d+|שת(?:י|יים|יים)?)\s+הזמנות.*(?:קיבלתי|הגיע).*רק|חסר(?:ים|ה)?\s+(?:לי\s+)?(?:פריט|מוצר|שטיח|חלק)|(?:לא\s+)?(?:קיבלתי|הגיע(?:ה|ו)?)\s+(?:את\s+)?(?:ה?(?:שני|2|שאר|מוצר|פריט|שטיח))|רק\s+חלק\s+מ(?:ן|)?(?:ה)?הזמנה|משלוח\s+חסר/i

export function isMissingOrPartialDeliveryComplaint(body: string) {
  return matchesMissingItem(body.trim())
}

function matchesMissingItem(text: string) {
  if (!text) return false
  return MISSING_ITEM_RE.test(text)
}

/** Classify post-purchase case from primary clause, then full message. */
export function classifyPostPurchaseCase(body: string): PostPurchaseCaseKind | null {
  const primary = primaryIntentText(body)
  const candidates = [primary, body.trim()].filter(Boolean)

  for (const text of candidates) {
    if (matchesReturnRequest(text)) return "return_request"
  }
  for (const text of candidates) {
    if (matchesMissingItem(text)) return "missing_item"
  }
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
