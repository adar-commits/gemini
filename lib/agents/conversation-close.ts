import { CUSTOMER_HEADER } from "@/lib/agents/types"
import { hasImmediateBusinessAsk } from "@/lib/agents/greeting"

/** Customer closing the thread — not a quiz answer and not "thanks, also I wanted to ask…". */
export function isConversationClosing(body: string) {
  const text = body.trim()
  if (!text || text.length > 100) return false
  if (hasImmediateBusinessAsk(text)) return false
  if (/תודה.*(?:גם|רציתי|עוד|שאל|אבל|רק)/i.test(text)) return false
  if (/^(?:לא|כן)[,\s]+(?:אבל|רק)/i.test(text)) return false

  return /^(?:תודה(?:\s+רבה)?|לא,?\s*תודה(?:\s+רבה)?|זה\s+הכל|אין\s+צורך|יום\s+טוב|ביי|להתראות|סבבה\s+תודה)(?:[\s,.!?🙏👍]*|$)/iu.test(
    text
  )
}

export function buildClosingAckReply() {
  return `${CUSTOMER_HEADER}\nבשמחה! אם תצטרכו משהו נוסף — אנחנו כאן.`
}
