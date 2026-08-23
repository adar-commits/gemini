const GREETING_RE =
  /^(?:שלום|היי|הי|אהלן|בוקר\s+טוב|ערב\s+טוב|מה\s+נשמע|מה\s+קורה|hello|hi|hey|good\s+(?:morning|evening))(?:[\s,!?.]+|$)/i

const GREETING_ONLY_RE = /^(?:שלום|היי|הי|אהלן)(?:[\s,!?.]+|$)/i

const SMALL_TALK_RE =
  /(?:מה\s+נשמע|מה\s+קורה|how\s+are\s+you|what'?s\s+up)/i

const BUSINESS_HINT_RE =
  /שעות|סניפ|מדיניות|משלוח|החזר|תשלום|איך\s+מחזיר|רוצה\s+לקנות|מחיר|שטיח|פוף|קרוע|פגום|לא\s+קיבלתי|משלוח(\s+שלי)?|הזמנה/i

export function isCasualGreeting(text: string) {
  const body = text.trim()
  if (!body || body.length > 100) return false
  if (GREETING_RE.test(body)) return true
  if (GREETING_ONLY_RE.test(body)) return true
  if (SMALL_TALK_RE.test(body) && body.split(/\s+/).length <= 8) return true
  return false
}

function firstName(name: string | undefined) {
  const part = name?.trim().split(/\s+/)[0]?.replace(/[^\p{L}'-]/gu, "")
  return part || ""
}

/** Warm opening when the customer says hello before stating a need. */
export function buildGreetingReply(customerName?: string) {
  const name = firstName(customerName)
  const nameBit = name ? ` ${name}` : ""
  return `שלומי טוב, תודה רבה! איך אוכל לעזור לך היום${nameBit}? 🙂`
}

export function isOpeningTurn(historyUserMessages: number) {
  return historyUserMessages <= 1
}

/** Hello + concrete ask in one message → skip the welcome template. */
export function hasImmediateBusinessAsk(text: string) {
  return BUSINESS_HINT_RE.test(text.trim())
}
