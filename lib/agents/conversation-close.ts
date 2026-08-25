import { CUSTOMER_HEADER } from "@/lib/agents/types"
import { hasImmediateBusinessAsk } from "@/lib/agents/greeting"

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
    )

  const resolvedClosing =
    /^(?:ה)?סתדר(?:תי|נו)(?:\s+תודה(?:\s+רבה)?)?(?:[\s,.!?🙏👍]*|$)/iu.test(
      text
    ) ||
    /^(?:סבבה|אוקיי|יופי|מעולה|בסדר)(?:\s*,?\s*תודה(?:\s+רבה)?)?(?:[\s,.!?🙏👍]*|$)/iu.test(
      text
    )

  return directClosing || resolvedClosing
}

export function buildClosingAckReply(customerName?: string) {
  const name = customerName?.trim()
  const greeting = name
    ? `שמחתי לעזור לך ${name}, אני כאן לכל עניין נוסף.`
    : "שמחתי לעזור לך, אני כאן לכל עניין נוסף."
  return `${CUSTOMER_HEADER}\n${greeting}`
}
