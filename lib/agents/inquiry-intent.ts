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
  | "exchange_request"
  | "return_request"
  | "return_pickup_pending"
  | "missing_item"

const RETURN_INTENT_RE =
  /(?:רוצ(?:ה|ים|ות)|(?:מ)?(?:עונ(?:ה|ים|ת)?|בקש(?:ה|ת)?))\s*(?:ל)?(?:ה)?(?:חזיר|החזר)|(?:נוכל|אפשר|מותר)\s+(?:ל)?(?:ה)?(?:חזיר|החזר)|(?:ל)?החזיר(?:\s+(?:ב(?:[א-ת]+|\d)|א(?:ת|ת)?|אות(?:ו|ה|ם)?))|(?:ב(?:ק|ק)ש(?:ה|ת)?\s+)?(?:ה)?החזר(?:ה|ות)?(?:\s|$)|(?:^|\s)(?:ביטול|זיכוי)(?:\s|$|[?.!,])/i

const EXCHANGE_INTENT_RE =
  /(?:רוצ(?:ה|ים|ות)|(?:מ)?(?:עונ(?:ה|ים|ת)?|בקש(?:ה|ת)?))\s*(?:ל)?(?:ה)?(?:חליף|החלפ)|(?:ל)?(?:ה)?חליף(?:\s+א(?:ת|ת)?|\s+אות(?:ו|ה|ם)?)|(?:ב(?:ק|ק)ש(?:ה|ת)?\s+)?(?:ה)?החלפ(?:ה|ות)?(?:\s|$|[?.!,])|(?:^|[\s,])(?:ו)?החלפ(?:ה|ות)?(?:\s|$|[?.!,])/i

const DEFECT_RE =
  /פגם|פגום|פגומ(?:ה|ים|ות)|קרוע|שבור|סדוק|מקולקל|נזק|ליקוי|פגם\s+ב(?:ה)?ובלה/i

const SOFT_PROBLEM_RE =
  /כתם|כתמים|ריח|רטוב|דהוי|לא\s+תקין|לא\s+בסדר|מוזר|יש\s+בעיה|משהו\s+לא\s+כ(?:\"|״|')?כ/i

const RECEIVED_RE = /(?:קיבלתי|הגיע(?:ה|ו)?|התקבל|קיבלנו)/i
const PRODUCT_RE = /(?:שטיח|פוף|מוצר|הזמנה|תמונ(?:ה|ת)|כרית)/i

const DISSATISFACTION_RE =
  /לא\s+(?:ממש\s+|כל\s+כ(?:\"|״|')?ך\s+|מ(?:די)?\s+)?(?:מרוצ|מתאים|א(?:וה|ה)ב(?:ת|ים|ות|ו)?|כ(?:\"|״|')?כ)|לא\s+א(?:וה|ה)ב\s+א(?:ת(?:ו|ה|ם)?|ה(?:שטיח|מוצר)|אות(?:ו|ה))|אי[\s-]?שביעות\s+רצון|לא\s+מה\s+ש(?:ציפיתי|ציפינו|ציפית)|(?:ל)?צער(?:י|נו)\s+(?:ש)?(?:אני|אנחנו)?\s*לא/i

const MISMATCH_RE =
  /צבע.*(?:לא\s+תואם|שונה|דהוי)|(?:לא\s+תואם|שונה\s+מ|דהוי).*?(?:אתר|תמונה|צבע)|נראה\s+שונה|שונה\s+בפועל|לא\s+כמו\s+ב(?:אתר|תמונה)|(?:פחות\s+)?(?:לא\s+)?מתאים(?:\s+לי|\s+ל(?:נו|כם))?|גוונ(?:י|ים).*(?:שונ|ורוד|כה(?:ה|ים)|בהיר)|(?:רשום|באתר).{0,30}(?:הגיע|קיבל)/i

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

/** Customer wants to exchange/replace a product — not a return/cancellation. */
export function mentionsExchangeIntent(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (EXCHANGE_INTENT_RE.test(trimmed)) return true
  if (
    /(?:מידה|גודל|צבע|דגם)\s+אחר/i.test(trimmed) &&
    /(?:החלפ|להחליף|(?:ל)?(?:ה)?חליף)/i.test(trimmed)
  ) {
    return true
  }
  return false
}

export function isExchangeOnlyIntent(text: string) {
  return mentionsExchangeIntent(text) && !mentionsReturnIntent(text)
}

const FUTURE_PURCHASE_RE =
  /(?:אחר(?:י)?\s+ש(?:א)?|לפני\s+(?:ש(?:א)?)?|כש(?:א)?|בעתיד|אם\s+(?:א)?(?:קנ|רכ)|(?:א|)?(?:קנ(?:ה|ו|יתי)?|רכ(?:ש|יב)(?:ה|תי|ו)?)|(?:א|)?(?:רצ(?:ה|ו|ית)?|תרצ(?:ה|ו|ית)?)\s+(?:ל)?(?:קנ|רכ))/i

const REFUND_TIMING_QUESTION_RE =
  /מתי(?:\s+\S+){0,5}\s+(?:א(?:קבל|ראה)|(?:מ)?(?:קבל|גיע)|(?:י(?:ופיע|ראה|גיע|היה)))\s*(?:את\s+)?(?:ה)?(?:החזר(?:ה|ים|ת)?|זיכוי)/i

const ALREADY_RETURNED_AT_BRANCH_RE =
  /(?:מסר(?:תי|נו|ה)|החזר(?:תי|נו|ה)|הבא(?:תי|נו)|הגע(?:תי|נו)).{0,80}(?:סניף|חנות)/i

const PICKUP_ALREADY_DONE_RE =
  /(?:אספ(?:ו|u)|נאס(?:ף|פ(?:ה|ו)?)|(?:כבר\s+)?(?:בוצע|עש(?:ו|ית(?:י)?))\s+(?:איסוף|ל(?:ק|ק)ח(?:ו|ה)?)|(?:ל)?ק(?:ח(?:ו|ה)?|קח(?:ו|ה)?)\s+(?:א(?:ת|ת)?\s+)?(?:ה)?(?:שטיח|פוף|מוצר)|הגיע(?:ו|ה)?\s+(?:ל)?(?:איסוף|לקחת))/i

const REFUND_STATUS_ASK_RE =
  /(?:מה\s+(?:קורה|המצב|סטטוס)|(?:מ)?(?:חכ(?:ה|ים|ות)|ממתin(?:ה|ים|ות)?)|(?:עדיין|טרם)\s+(?:לא\s+)?(?:קיבל(?:תי|נו)?|רא(?:יתי|ינו)?)|עדכון|(?:אפשר|רוצ(?:ה|ים|ות))\s+(?:ל)?(?:דעת|לקבל\s+עדכון)).{0,40}(?:ה)?(?:החזר(?:ה|ים|ת)?|זיכוי)/i

/** Customer already returned and asks when money/credit arrives — not where/how to return. */
export function isRefundTimelineQuestion(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return false

  if (REFUND_TIMING_QUESTION_RE.test(trimmed)) return true

  if (
    ALREADY_RETURNED_AT_BRANCH_RE.test(trimmed) &&
    /(?:ה)?(?:החזר(?:ה|ים|ת)?|זיכוי)/i.test(trimmed)
  ) {
    return true
  }

  return false
}

/** How to redeem credit / credit code — not refund timeline or pickup status. */
export function isCreditRedemptionQuestion(text: string) {
  const trimmed = text.trim()
  if (!trimmed || trimmed.length > 220) return false
  if (isRefundTimelineQuestion(trimmed)) return false
  if (isRefundStatusInquiry(trimmed)) return false
  if (isCreditCodeOnlineRedemptionRequest(trimmed)) return false

  return (
    /(?:קוד\s+)זיכוי/i.test(trimmed) ||
    (/זיכוי/i.test(trimmed) &&
      /(?:איך|כיצד|מ?(?:ממש|ממש)|לבצע|לממש|מימוש|אונליין|באתר|באינטרנט)/i.test(
        trimmed
      ))
  )
}

export function isCreditRedemptionPolicyPending(history: { role: string; content: string }[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    return /על איזה זיכוי מדובר|למימוש באתר אעביר/i.test(message.content)
  }
  return false
}

/** Credit code redemption online — hand off to service (not self-service on site). */
export function isCreditCodeOnlineRedemptionRequest(
  text: string,
  history: { role: string; content: string }[] = []
) {
  const trimmed = text.trim()
  if (!trimmed || trimmed.length > 120) return false
  if (isRefundTimelineQuestion(trimmed)) return false

  if (/קוד\s+זיכוי/i.test(trimmed) && /(?:אונליין|באתר|באינטרנט)/i.test(trimmed)) {
    return true
  }

  if (isCreditRedemptionPolicyPending(history)) {
    if (/^2(?:[\s.)]|$)/.test(trimmed)) return true
    if (/קוד\s+זיכוי/i.test(trimmed)) return true
    if (/^(?:בא(?:תר|ינטרנט)|אונליין)(?:[\s,.!?]|$)/i.test(trimmed)) return true
    if (
      /^(?:כן|מ?(?:ממש|ממש)|רוצ(?:ה|ים|ות))(?:[\s,.!?]|$)/i.test(trimmed) &&
      /(?:אונליין|באתר|באינטרנט)/i.test(trimmed)
    ) {
      return true
    }
  }

  return false
}

/** Policy / hypothetical exchange question — portal is NOT used for exchanges. */
export function isExchangePolicyQuestion(text: string) {
  const trimmed = text.trim()
  if (!trimmed || !mentionsExchangeIntent(trimmed)) return false
  if (isActiveReturnExchangePickupCase(trimmed)) return false
  if (mentionsReturnIntent(trimmed)) return false

  if (
    /(?:איך|מה\s+(?:ה)?(?:דרך|מדיניות|אפשר|עושים|לעשות)|מה\s+(?:ה)?(?:אפשרויות|אופציות))/i.test(
      trimmed
    )
  ) {
    return true
  }

  if (
    RECEIVED_RE.test(trimmed) &&
    mentionsExchangeIntent(trimmed) &&
    /(?:מה\s+(?:ע(?:לי|ל|ל)?|אפשר|לעשות|צריך|עושים)|איך\s+(?:עושים|מ(?:בצעים|חליפים)|מחליפים))/i.test(
      trimmed
    )
  ) {
    return true
  }

  return false
}

/** Policy / hypothetical return question — not an active return request. */
export function isReturnPolicyQuestion(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return false

  if (isExchangePolicyQuestion(trimmed)) return false

  if (isRefundTimelineQuestion(trimmed)) return true

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

  if (
    RECEIVED_RE.test(trimmed) &&
    /(?:להחזיר|החזר)/i.test(trimmed) &&
    /(?:מה\s+(?:ע(?:לי|ל|ל)?|אפשר|לעשות|צריך|עושים)|איך\s+(?:עושים|מ(?:בצעים|חזירים)|מחזירים))/i.test(
      trimmed
    )
  ) {
    return true
  }

  if (/במידה\s+(?:ו|ש)/i.test(trimmed) && /(?:להחזיר|החזיר|החזר|זיכוי|ביטול)/i.test(trimmed)) {
    return true
  }

  if (
    /לא\s+(?:ימצא\s+)?חן\s+בעינ/i.test(trimmed) &&
    /(?:להחזיר|החזיר|החזר|זיכוי)/i.test(trimmed)
  ) {
    return true
  }

  if (
    /(?:נוכל|אפשר|מותר).*(?:ל)?(?:ה)?(?:חזיר|החזר)/i.test(trimmed) &&
    !/^(?:החזרה|ביצוע\s+החזרה)/i.test(trimmed)
  ) {
    return true
  }

  return false
}

/** Hypothetical return eligibility — policy FAQ, not execution or pickup wait. */
export function isReturnEligibilityQuestion(
  body: string,
  history: { role: string; content: string }[] = []
) {
  const text = body.trim()
  if (!text) return false
  if (isActiveReturnExchangePickupCase(text)) return false
  if (classifyPostPurchaseCase(text)) return false
  if (isReturnPolicyQuestion(text)) return true

  const recentUser = history
    .filter((message) => message.role === "user")
    .slice(-3)
    .map((message) => message.content)
  const thread = [...recentUser, text].join("\n")

  if (
    RECEIVED_RE.test(thread) &&
    /(?:במידה|אם|לא\s+(?:ימצא\s+)?חן|(?:נוכל|אפשר|מותר)|מה\s+(?:מ(?:ותר|המדיניות)|אפשר)).{0,80}(?:להחזיר|החזיר|החזר|זיכוי|ביטול)/i.test(
      text
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

function matchesExchangeRequest(text: string) {
  if (!text || isExchangePolicyQuestion(text) || isReturnPolicyQuestion(text)) return false
  if (!mentionsExchangeIntent(text)) return false
  if (mentionsReturnIntent(text)) return false
  if (FUTURE_PURCHASE_RE.test(text) && !RECEIVED_RE.test(text)) return false
  if (/^(?:החלפה|ביצוע\s+החלפה)(?:[\s,.!?]|$)/i.test(text.trim())) return true
  if (RECEIVED_RE.test(text) || PRODUCT_RE.test(text)) return true
  return false
}

function matchesReturnRequest(text: string) {
  if (!text || isReturnPolicyQuestion(text) || isReturnFlowCorrection(text)) return false
  if (mentionsExchangeIntent(text)) return false
  if (!mentionsReturnIntent(text)) return false
  if (FUTURE_PURCHASE_RE.test(text) && !RECEIVED_RE.test(text)) return false
  // Explicit execution after policy — not a general "what are my options?" ask.
  if (/^(?:החזרה|ביצוע\s+החזרה)(?:[\s,.!?]|$)/i.test(text.trim())) return true
  if (RECEIVED_RE.test(text) || PRODUCT_RE.test(text)) return true
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

const PICKUP_WAIT_VERB_RE =
  /(?:מחכ(?:ה|ים|ות)|(?:ל)?(?:חכ(?:ה|ות|ית))|מ(?:מתינ(?:ה|ים|ות)?|צ(?:פ(?:ה|ים|ות)?)?|ש(?:ך|כה)))/i

const PICKUP_ACTION_RE =
  /(?:ש)?(?:יאספ(?:ו|u)|(?:ל)?(?:איסוף|לאסוף|אספ)|(?:ש)?(?:ליח|משלוח)\s+(?:י(?:בוא|גיע)|(?:ל)?(?:איסוף|החזרה)))/i

/** Waiting for courier/home pickup — allow filler words between verb and action (e.g. "ממתין גבר שבועיים שיאספו"). */
function hasPickupWaitSignal(text: string) {
  if (
    /(?:ש)?(?:יאספ(?:ו|u)\s+ממני|(?:ל)?(?:איסוף|לאסוף).{0,30}ממני)/i.test(text) &&
    /(?:שטיח|פוף|מוצר|להחזיר|החזר)/i.test(text)
  ) {
    return true
  }

  const waitStem = "מתין" // מתinin with final nun
  const waitPattern = new RegExp(
    `(?:מ)?(?:${waitStem}(?:ה|ים|ות)?|חכ(?:ה|ים|ות|ית)|מ(?:ש(?:ך|כה)|צ(?:פ(?:ה|ים|ות)?)?)).{0,100}(?:ש)?(?:יאספ(?:ו|u)|(?:ל)?(?:איסוף|לאסוף|אספ))`,
    "i"
  )
  if (waitPattern.test(text)) return true

  if (
    /(?:עדיין|כבר).{0,35}(?:לא\s+(?:בא(?:ו|ה)|הגיע(?:ו|ה)?|אספ(?:ו|u)|יצא(?:ו|ה)?)|(?:מ)?(?:חכ(?:ה|ים|ות)|מתinin(?:ה|ים|ות)?))/i.test(
      text
    )
  ) {
    return true
  }
  if (
    /(?:לא\s+(?:בא(?:ו|ה)|הגיע(?:ו|ה)?)\s+(?:ל)?(?:לאסוף|לקחת|אסוף))/i.test(text)
  ) {
    return true
  }
  if (
    /(?:הרבה|כ(?:"|״|')?ל\s+כ(?:"|״|')?ך)\s+זמן.{0,40}(?:ש)?(?:יאספ(?:ו|u)|(?:ל)?(?:איסוף|לאסוף|אספ))/i.test(
      text
    )
  ) {
    return true
  }

  const verbMatch = text.match(PICKUP_WAIT_VERB_RE)
  if (!verbMatch || verbMatch.index == null) return false

  const afterVerb = text.slice(verbMatch.index + verbMatch[0].length, verbMatch.index + 120)
  return PICKUP_ACTION_RE.test(afterVerb)
}

const PICKUP_WAIT_RE = {
  test(text: string) {
    return hasPickupWaitSignal(text)
  },
}

/** Customer submitted a return via portal and is waiting for courier pickup — not starting a new return. */
function isReturnPickupWaitComplaint(text: string) {
  const hasPickupWait =
    PICKUP_WAIT_RE.test(text) ||
    /(?:ל)?(?:חכ(?:ה|ות|ית)|מ(?:מתינ(?:ה|ים|ות)?|ש(?:ך|כה))).{0,45}(?:ש)?(?:יאספ(?:ו|u)|(?:ל)?(?:איסוף|לאסוף|אספ))/i.test(
      text
    ) ||
    /(?:הרבה|כ(?:\"|״|')?ל\s+כ(?:\"|״|')?ך)\s+זמן.{0,45}(?:ש)?(?:יאספ(?:ו|u)|(?:ל)?(?:איסוף|לאסוף|אספ))/i.test(
      text
    )

  const hasReturnContext =
    /(?:שטיח|פוף|מוצר|הזמנה|החזר|החזיר|להחזיר|איסוף)/i.test(text)

  return hasPickupWait && hasReturnContext
}

const ALREADY_INITIATED_RETURN_EXCHANGE_RE =
  /(?:ביצע(?:תי|נו|ה)|עש(?:יתי|ינו)|פתח(?:תי|נו)|הגש(?:תי|נו)|התחל(?:תי|נו)|(?:כבר\s+)?(?:ב(?:ק|ק)ש(?:תי|נו))).{0,50}(?:החלפ(?:ה|ות)?|החזר(?:ה|ות)?|בקש(?:ת|ה)\s+(?:ה)?(?:החלפ|החזר))|(?:החלפ(?:ה|ות)?|החזר(?:ה|ות)?).{0,40}(?:ב(?:וצע(?:ה|ו)?|תהליך)|(?:כבר\s+)?(?:פתח(?:תי|נו)|הגש(?:תי|נו)|ב(?:ק|ק)ש(?:תי|נו)))/i

const MISSING_ITEM_RE =
  /(?:קיבלתי|הגיע(?:ה|ו)?)\s+רק|רק\s+(?:אח(?:ת|ד)|חלק|ח(?:מ)?יש(?:ה|ית)?)|(?:\d+|שת(?:י|יים|יים)?)\s+הזמנות.*(?:קיבלתי|הגיע).*רק|חסר(?:ים|ה)?\s+(?:לי\s+)?(?:פריט|מוצר|שטיח|חלק)|(?:לא\s+(?:קיבלתי|הגיע(?:ה|ו)?)\s+(?:את\s+)?(?:ה?(?:שני|2|שאר|מוצר|פריט|שטיח))|(?:קיבלתי|הגיע(?:ה|ו)?)\s+(?:את\s+)?(?:ה?(?:שני|2|שאר)))|רק\s+חלק\s+מ(?:ן|)?(?:ה)?הזמנה|משלוח\s+חסר/i

function isPolicyInformationQuestion(text: string) {
  if (isRefundTimelineQuestion(text)) return true
  return /(?:איך|מה\s+(?:ה)?(?:דרך|מדיניות|אפשר|עושים|לעשות)|מה\s+(?:ה)?(?:אפשרויות|אופציות))/i.test(
    text
  )
}

/** Customer already opened return/exchange and is waiting for courier pickup — not policy FAQ. */
export function isActiveReturnExchangePickupCase(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (isReturnFlowCorrection(trimmed)) return false
  if (isPolicyInformationQuestion(trimmed) && !isReturnPickupWaitComplaint(trimmed)) {
    return false
  }

  if (isReturnPickupWaitComplaint(trimmed)) return true

  const hasPickupWait = PICKUP_WAIT_RE.test(trimmed)
  const hasInitiated =
    ALREADY_INITIATED_RETURN_EXCHANGE_RE.test(trimmed) ||
    /(?:ביצע(?:תי|נו|ה)|פתח(?:תי|נו)|הגש(?:תי|נו)).{0,30}(?:החלפ|החזר)/i.test(trimmed)

  if (hasPickupWait && (hasInitiated || /(?:שטיח|פוף|מוצר|הזמנה)/i.test(trimmed))) {
    return true
  }

  if (hasPickupWait && /(?:החלפ|החזר|איסוף|להחזיר)/i.test(trimmed)) {
    return true
  }

  return false
}

/** Pickup already done — customer asks about refund status (service handoff, not order API). */
export function isRefundStatusInquiry(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (isRefundTimelineQuestion(trimmed)) return false
  if (isActiveReturnExchangePickupCase(trimmed)) return false

  const pickupDone = PICKUP_ALREADY_DONE_RE.test(trimmed)
  const asksRefundStatus =
    REFUND_STATUS_ASK_RE.test(trimmed) ||
    /(?:ה)?(?:החזר(?:ה|ים|ת)?|זיכוי).{0,30}(?:מה\s+(?:קורה|המצב)|(?:עדיין|טרם)|מתי\s+(?:א(?:קבל|ראה)))/i.test(
      trimmed
    )

  return pickupDone && asksRefundStatus
}

/** Ship a product from warehouse/storage — service execution, not shipping status lookup. */
export function isWarehouseShipRequest(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return false
  const hasStorage = /(?:אחסון|אחסנה|מחסן|warehouse)/i.test(trimmed)
  const wantsShip =
    /(?:ל)?של(?:ch|וח|ח(?:ו|י|ים|נ)?)|משל(?:ch|וח)|מבקש(?:ה|ים|ות).{0,25}(?:ל)?של/i.test(
      trimmed
    )
  return hasStorage && wantsShip
}

/** Customer cannot visit a branch (heavy item, mobility) — home pickup, not branch list. */
export function isCantVisitBranchReturnHelp(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (isRefundTimelineQuestion(trimmed)) return false
  const cantVisit =
    /(?:לא\s+(?:יכול(?:ה|ים|ות)?|מ(?:צליח(?:ה|ים|ות)?)?)\s+(?:ל)?(?:הגיע|לבוא|להגיע)|(?:כבד|מ(?:כ(?:בד|ובד)|ס(?:י)?יב)|לא\s+(?:נ(?:וח|יתן)|מעש(?:י|ית))\s+(?:ל)?(?:הגיע|לבוא)))/i.test(
      trimmed
    )
  const returnContext =
    /(?:החזר(?:ה|ות)?|להחזיר|החלפ(?:ה|ות)?|(?:ל)?(?:ה)?סניף|איסוף\s+מהבית)/i.test(trimmed)
  return cantVisit && returnContext
}

export function hasServiceUrgencySignal(text: string) {
  return /(?:ללד(?:ת|ות)|הריון|לידה|דח(?:וף|ופ)|בהקדם\s+האפשרי)/i.test(text.trim())
}

export function isMissingOrPartialDeliveryComplaint(body: string) {
  return matchesMissingItem(body.trim())
}

function matchesMissingItem(text: string) {
  if (!text) return false
  return MISSING_ITEM_RE.test(text)
}

function matchesReturnPickupPending(text: string) {
  return isActiveReturnExchangePickupCase(text)
}

/** Classify post-purchase case from primary clause, then each line, then full message. */
export function classifyPostPurchaseCase(body: string): PostPurchaseCaseKind | null {
  const primary = primaryIntentText(body)
  const lines = body
    .trim()
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
  const candidates = [...new Set([primary, ...lines, body.trim()].filter(Boolean))]

  for (const text of candidates) {
    if (matchesReturnPickupPending(text)) return "return_pickup_pending"
  }
  for (const text of candidates) {
    if (matchesExchangeRequest(text)) return "exchange_request"
  }
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
