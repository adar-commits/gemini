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
  /שעות|סני[פף]|מדיניות|משלוח|החזר|תשלום|איך\s+מחזיר|רוצה\s+לקנות|מחפש(?:ים|ת|ים)?\s+ל?(?:קנות|לקנות)|מחיר|שטיח|פוף|קרוע|פגום|לא\s+קיבלתי|משלוח(\s+שלי)?|הזמנה|פתוח|סגור|עד\s+מתי|מתי\s+פתוח|מחר|היום|כתובת|איפה|מיקום|קריית|איירפורט|קבלה|חשבונית|העתק|עותק|receipt|invoice/i

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

/** Strip LLM slash-gender forms — הום בוט is male. */
export function sanitizeBotGenderSlashes(text: string) {
  return text
    .replace(/שמח\/ה/g, "שמח")
    .replace(/מצטער\/ת/g, "מצטער")
    .replace(/שמח\/ת/g, "שמח")
}

/** One *הום בוט :)* header — drop repeated name lines in the greeting body. */
export function dedupeGreetingBotName(reply: string) {
  if (!reply.includes(CUSTOMER_HEADER) && !reply.trim().startsWith("הום בוט :)")) {
    return reply
  }
  return reply.replace(
    /\n?היי!\s*כאן\s+הום\s+בוט\s*:?\)?\s*\n?/gi,
    "\nהיי! "
  )
}

const HEADER_MARKDOWN_RE = /^\*הום בוט :\)\*\n?/
const HEADER_PLAIN_RE = /^הום בוט :\)\s*\n?/

/** Remove the customer header from the start of a message. */
export function stripCustomerHeader(text: string) {
  return text.replace(HEADER_MARKDOWN_RE, "").replace(HEADER_PLAIN_RE, "").trimStart()
}

/** Keep at most one header — collapse duplicate titles inside one reply. */
export function ensureSingleCustomerHeader(text: string) {
  const normalized = text.trim()
  if (!/(?:\*הום בוט :\)\*|^הום בוט :\))/m.test(normalized)) return normalized

  const body = normalized
    .replace(/(?:\*הום בוט :\)\*|הום בוט :\))\s*\n?/g, "\n")
    .replace(/^\n+/, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  if (!body) return CUSTOMER_HEADER
  if (body.startsWith(CUSTOMER_HEADER)) return body
  return `${CUSTOMER_HEADER}\n${body}`
}

/** First outbound keeps header; follow-ups in the same burst do not repeat it. */
export function formatOutboundMessages(
  messages: string[],
  options?: { headerAlreadySent?: boolean }
): { messages: string[]; headerSent: boolean } {
  let headerSent = options?.headerAlreadySent ?? false
  const formatted = messages
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => {
      const single = ensureSingleCustomerHeader(raw)
      if (headerSent) return stripCustomerHeader(single)
      if (HEADER_MARKDOWN_RE.test(single) || HEADER_PLAIN_RE.test(single)) {
        headerSent = true
        return single
      }
      return single
    })
  return { messages: formatted, headerSent }
}

/** Opening welcome — single header, no repeated bot name, masculine voice. */
export function buildGreetingReply(_customerName?: string) {
  return `${CUSTOMER_HEADER}
היי! שמח שפנית — במה אוכל לעזור היום? 😀`
}

export function isSelfContainedGreetingReply(reply: string) {
  const text = reply.trim().replace(/^\*הום בוט :\)\*\n?/, "")
  return /^היי!\s+(?:כאן\s+הום\s+בוט|שמח\s+שפנית)/i.test(text)
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
    return `${CUSTOMER_HEADER}\n${line}\nרוצים שאמשיך לעזור כאן, או להעביר ליועץ?`
  }

  return `${CUSTOMER_HEADER}\n${line}\nבמה אוכל לעזור?`
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
