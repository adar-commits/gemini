import {
  CUSTOMER_HEADER,
  CUSTOMER_NATURAL_CLOSE,
  ORDER_STATUS_HELP_OFFER,
  POLITE_HELP_CLOSE,
} from "@/lib/agents/types"
import { hasImmediateBusinessAsk } from "@/lib/agents/greeting"

/** Warm resolution closings — not mandatory questions; silence means thread is done. */
const WARM_CONVERSATION_CLOSES = [
  POLITE_HELP_CLOSE,
  ORDER_STATUS_HELP_OFFER,
  CUSTOMER_NATURAL_CLOSE,
  "שמחתי לעזור היום",
  "שמחתי לעזור!",
  "אם יש משהו נוסף שאוכל לעזור בו, אני כאן",
] as const

export function buildWarmConversationCloseLine(customerName?: string) {
  const name = customerName?.trim()
  return name ? `${name}, שמחתי לעזור היום! 😊` : "שמחתי לעזור היום! 😊"
}

export function buildWarmConversationCloseReply(customerName?: string) {
  return `${CUSTOMER_HEADER}\n${buildWarmConversationCloseLine(customerName)}`
}

/** Resolved status/preorder card — close the thread (action end), not a pending question. */
export function isResolvedStatusCloseReply(content: string) {
  const body = content.replace(CUSTOMER_HEADER, "").trim()
  if (!body) return false
  if (/נכון\?/i.test(body)) return false
  if (/האם להעביר/i.test(body)) return false
  if (/איזה פריט לא הגיע/i.test(body)) return false
  if (/לא ניתן להציג כרגע סטטוס משלוח/i.test(body)) return false
  if (/אז מסכם את הפנייה/i.test(body)) return false
  return /בדקתי/i.test(body) && endsWithOptionalFollowUpOffer(content)
}

/** Bot ended with a warm close — customer silence is a natural end. */
export function endsWithOptionalFollowUpOffer(content: string) {
  const body = content.replace(CUSTOMER_HEADER, "").trim()
  return WARM_CONVERSATION_CLOSES.some((closing) => body.includes(closing))
}

/** Post-answer closings (current or legacy) — skip when scanning for prior substantive bot turns. */
export function isSkippableClosingAssistantMessage(content: string) {
  const body = content.replace(CUSTOMER_HEADER, "").trim()
  if (!body) return false
  if (endsWithOptionalFollowUpOffer(content)) return true
  if (/במה עוד (?:אוכל|נוכל) לעזור/i.test(body)) return true
  if (/אפשר לעזור במשהו נוסף/i.test(body)) return true
  if (/יש עוד שאלה/i.test(body)) return true
  if (/אם צריך עוד משהו — אני כאן/i.test(body)) return true
  if (/אם יש משהו נוסף שאוכל לעזור בו, אני כאן/i.test(body)) return true
  if (!/בדקתי,/i.test(body) && /שמחתי לעזור/i.test(body) && body.length <= 160) {
    return true
  }
  if (
    !/בדקתי,/i.test(body) &&
    /בשמחה/i.test(body) &&
    body.length <= 120 &&
    !/\?/.test(body.replace(/בשמחה[^?!]*[?!]/gi, ""))
  ) {
    return true
  }
  return false
}

/** Punctuation-only follow-ups ("?", "???") — not a new business ask. */
export function isNonSubstantiveFollowUp(body: string) {
  const text = body.trim()
  if (!text || text.length > 12) return false
  return /^[?!.,\s🙏👍]+$/u.test(text)
}

/** Common misspellings of תודה — not a quiz answer or new request. */
export function looksLikeThanksTypo(body: string) {
  const core = body.trim().replace(/[\s,.!?🙏👍]+/g, "")
  if (!core || core.length < 3 || core.length > 12) return false
  if (/^תודה/i.test(core)) return true
  return /^תו?[דז][הא]?$|^ת[דז]וה$|^טודה$/u.test(core)
}

/** Customer closing the thread — not a quiz answer and not "thanks, also I wanted to ask…". */
export function isConversationClosing(body: string) {
  const text = body.trim()
  if (!text || text.length > 100) return false
  if (hasImmediateBusinessAsk(text)) return false
  if (/תודה.*(?:גם|רציתי|עוד|שאל|אבל|רק)/i.test(text)) return false
  if (/^(?:לא|כן)[,\s]+(?:אבל|רק)/i.test(text)) return false

  const directClosing =
    /^(?:תודה(?:\s+רבה)?|לא,?\s*תודה(?:\s+רבה)?|זה\s+הכל|אין\s+צורך|יום\s+טוב|ביי|להתראות|סבבה\s+תודה|בסדר\s+תודה|מעולה\s+תודה|יופי\s+תודה)(?:[\s,.!?🙏👍]*|$)/iu.test(
      text
    ) ||
    looksLikeThanksTypo(text)

  const resolvedClosing =
    /^(?:ה)?סתדר(?:תי|נו)(?:\s+תודה(?:\s+רבה)?)?(?:[\s,.!?🙏👍]*|$)/iu.test(
      text
    ) ||
    /^(?:סבבה|אוקיי|יופי|מעולה|בסדר)(?:\s*,?\s*תודה(?:\s+רבה)?)?(?:[\s,.!?🙏👍]*|$)/iu.test(
      text
    )

  return directClosing || resolvedClosing
}

/** Thanks / wrap-up wording — conversation stays open (never action=end). */
export function isThanksAcknowledgment(body: string) {
  return isConversationClosing(body)
}

export function buildThanksAckReply(
  customerName?: string,
  options?: { handoffPending?: boolean; postHandoff?: boolean }
) {
  if (options?.postHandoff) {
    const name = customerName?.trim()
    const greeting = name ? `${name}, בשמחה! 😊` : "בשמחה! 😊"
    return `${CUSTOMER_HEADER}
${greeting} הנציג כבר קיבל את הפנייה ויצור קשר בהקדם.`
  }

  if (options?.handoffPending) {
    return `${CUSTOMER_HEADER}
בשמחה! 🙏 אם תרצו שאעביר לנציג — כתבו כן. יש עוד שאלה? אני כאן.`
  }

  return buildWarmConversationCloseReply(customerName)
}

/** @deprecated Use buildThanksAckReply — kept for callers expecting the old name. */
export function buildClosingAckReply(customerName?: string) {
  return buildThanksAckReply(customerName)
}
