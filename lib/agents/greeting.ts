import type { HistoryMessage } from "@/lib/agents/types"
import { CUSTOMER_HEADER } from "@/lib/agents/types"

const LEADING_GREETING_RE =
  /^(?:שלום|היי|הי|אהלן|בוקר\s+טוב|ערב\s+טוב|מה\s+נשמע|מה\s+קורה|מה\s+שלומ(?:ך|כם)|hello|hi|hey|good\s+(?:morning|evening))(?:[\s,!?.]+)*/iu

const GREETING_ONLY_RE = /^(?:שלום|היי|הי|אהלן)(?:[\s,!?.]+|$)/i

const SMALL_TALK_RE =
  /(?:מה\s+נשמע|מה\s+קורה|מה\s+שלומ(?:ך|כם)|how\s+are\s+you|what'?s\s+up)/i

/** Customer checking we're still here — answer warmly, never stay silent. */
const PING_RE =
  /^(?:הלו|hello)\??$|אתה\s+(?:לא\s+)?(?:עונה|שם|מאזין|קיים)|יש\s+מישהו|מישהו\s+שם|למה\s+לא\s+עונ/i

const BUSINESS_HINT_RE =
  /שעות|סני[פף]|מדיניות|משלוח|החזר|תשלום|איך\s+מחזיר|רוצה\s+לקנות|מחיר|שטיח|פוף|קרוע|פגום|לא\s+קיבלתי|משלוח(\s+שלי)?|הזמנה|פתוח|סגור|עד\s+מתי|מתי\s+פתוח|מחר|היום|כתובת|איפה|מיקום|קריית|איירפורט/i

function stripLeadingGreetings(text: string) {
  let body = text.trim()
  for (let i = 0; i < 3; i++) {
    const next = body.replace(LEADING_GREETING_RE, "").trim()
    if (next === body) break
    body = next
  }
  return body
}

export function isCasualGreeting(text: string) {
  const body = text.trim()
  if (!body || body.length > 100) return false
  if (hasImmediateBusinessAsk(body)) return false

  const remainder = stripLeadingGreetings(body)
  if (!remainder) return true
  if (GREETING_ONLY_RE.test(remainder)) return true
  if (SMALL_TALK_RE.test(remainder) && remainder.split(/\s+/).length <= 6) {
    return true
  }
  if (/\?/.test(remainder) || remainder.split(/\s+/).length >= 4) return false
  if (remainder.length >= 12) return false

  return GREETING_ONLY_RE.test(body) || SMALL_TALK_RE.test(body)
}

/** Greeting, wellbeing check, or "are you there?" — works mid-conversation too. */
export function isCasualSmallTalk(text: string) {
  const body = text.trim()
  if (!body || body.length > 120) return false
  if (hasImmediateBusinessAsk(body)) return false
  if (isCasualGreeting(body)) return true
  if (PING_RE.test(body) && body.split(/\s+/).length <= 10) return true
  return false
}

export async function isCasualGreetingWithLearned(text: string) {
  if (isCasualGreeting(text)) return true
  const { matchesLearnedGreeting } = await import("@/lib/agents/learned-rules")
  return matchesLearnedGreeting(text)
}

/** Warm opening when the customer says hello before stating a need. */
export function buildGreetingReply(_customerName?: string) {
  return `שלום! כאן הום בוט :)
אצלי הכל מצוין, תודה! איך אוכל לעזור לך היום? 🙂`
}

/** Natural reply to wellbeing / ping messages — not only on the opening turn. */
export function buildCasualSmallTalkReply(text: string, handoffPending = false) {
  const body = text.trim()
  let line: string

  if (PING_RE.test(body)) {
    line = "כן, אני כאן! סליחה אם התשובה התעכבה."
  } else if (/מה\s+שלומ/i.test(body)) {
    line = "בסדר גמור, תודה! 🙂"
  } else if (SMALL_TALK_RE.test(body)) {
    line = "הכל טוב, תודה!"
  } else {
    return buildGreetingReply()
  }

  if (handoffPending) {
    return `${CUSTOMER_HEADER}\n${line}\nהאם להעביר את הפנייה כעת ליועץ מכירות ועיצוב אנושי?`
  }

  return `${CUSTOMER_HEADER}\n${line}\nאיך אוכל לעזור לך היום?`
}

export function isOpeningTurn(historyUserMessages: number) {
  return historyUserMessages <= 1
}

/** First hello after a session reset — landbot legacy history must not block the welcome. */
export function shouldWelcomeAfterReset(
  resetAt: string | null,
  lastAction: string | null,
  history: HistoryMessage[]
) {
  if (lastAction === "reset") return true
  if (!resetAt) return false
  return !history.some((message) => message.role === "assistant")
}

/** Hello + concrete ask in one message → skip the welcome template. */
export function hasImmediateBusinessAsk(text: string) {
  return BUSINESS_HINT_RE.test(text.trim())
}
