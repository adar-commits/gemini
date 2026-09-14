import { CUSTOMER_HEADER } from "@/lib/agents/types"

const COMPLETE_REPLY_ENDING = /[.!?…*"»)\]😊🙏👋]\s*$/

function bodyWithoutHeader(reply: string) {
  return reply
    .replace(/^\*הום בוט :\)\*\n?/g, "")
    .replace(new RegExp(`^${CUSTOMER_HEADER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n?`, "g"), "")
    .trim()
}

/** Customer-visible reply cut off before a complete sentence (output-token cap mid-JSON). */
export function isLikelyTruncatedBotReply(reply: string) {
  const body = bodyWithoutHeader(reply)
  if (body.length < 50) return false
  if (COMPLETE_REPLY_ENDING.test(body)) return false
  if (/[\u0590-\u05FF]$/.test(body)) return true
  if (/[,—–-]\s*$/.test(body)) return true
  if (/\\+"?\s*$/.test(body)) return true
  return false
}

function dropIncompleteTrailingParagraphs(text: string) {
  const paragraphs = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean)
  while (paragraphs.length > 1) {
    const last = paragraphs[paragraphs.length - 1]
    if (last && !COMPLETE_REPLY_ENDING.test(last) && /[\u0590-\u05FF]$/.test(last)) {
      paragraphs.pop()
      continue
    }
    break
  }
  return paragraphs.join("\n\n").trim()
}

function dropIncompleteTrailingSentence(text: string) {
  const parts = text.split(/(?<=[.!?…])\s+/u)
  const last = parts[parts.length - 1]?.trim() ?? ""
  if (parts.length > 1 && last && !COMPLETE_REPLY_ENDING.test(last)) {
    return parts.slice(0, -1).join(" ").trim()
  }
  if (!COMPLETE_REPLY_ENDING.test(text) && /[\u0590-\u05FF]$/.test(text)) {
    const sentenceStart = Math.max(
      text.lastIndexOf("\n"),
      text.lastIndexOf(". "),
      text.lastIndexOf("! "),
      text.lastIndexOf("? ")
    )
    if (sentenceStart > 40) {
      return text.slice(0, sentenceStart).trim()
    }
  }
  return text.trim()
}

function truncationCompletionTail(repaired: string) {
  if (/תיאום|משלוח|מסירה|אספקה|שליח|יום\s+רביע/i.test(repaired)) {
    return (
      "בקשה לדחיית מסירה (למשל \"מיום X ואילך\") לא נקבעת מראש במערכת — אפשר לציין אותה, ובמידת הצורך לפנות ל*3076 עם מספר הזמנה.\n\n" +
      "יש מספר הזמנה לבדיקת סטטוס?"
    )
  }
  if (/כרטיס\s+נטען|מועדון|תשלום|גיפט/i.test(repaired)) {
    return "נציג שירות יכול לעזור להשלים — להעביר לנציג שירות?"
  }
  return "נראה שההודעה נקטעה — כתבו אם משהו חסר ואשלים 🙂"
}

/** Strip dead-end tails and append a complete closing when output was cut mid-sentence. */
export function repairTruncatedBotReply(reply: string) {
  let text = reply.trim()
  if (!text) return reply

  text = text.replace(/\\+"\s*$/g, "").trimEnd()

  if (/אין לי מידע\s+מד/u.test(text)) {
    const withoutDeadEnd = text
      .replace(/\n?\n?לגבי כרטיס נטען[^\n]*$/iu, "")
      .trim()
    const base =
      withoutDeadEnd.length >= 40
        ? withoutDeadEnd
        : "*הום בוט :)*\nלגבי תשלום במועדון או כרטיס נטען"
    return `${base}\n\nנציג שירות יכול לעזור להשלים — להעביר לנציג שירות?`
  }

  if (!isLikelyTruncatedBotReply(text)) return text

  let repaired = dropIncompleteTrailingParagraphs(text)
  repaired = dropIncompleteTrailingSentence(repaired)
  if (repaired.length < 40) return text

  return `${repaired}\n\n${truncationCompletionTail(repaired)}`
}
