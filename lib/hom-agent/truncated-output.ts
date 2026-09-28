import { CUSTOMER_HEADER } from "@/lib/agents/types"

const COMPLETE_REPLY_ENDING = /[.!?…*"»)\]😊🙏👋]\s*$/

function bodyWithoutHeader(reply: string) {
  return reply
    .replace(/^\*הום בוט :\)\*\n?/g, "")
    .replace(new RegExp(`^${CUSTOMER_HEADER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n?`, "g"), "")
    .trim()
}

/** A question followed by 2+ numbered options (e.g. document-type menu) is complete without punctuation. */
function endsWithNumberedMenu(body: string) {
  const lines = body.split("\n").map((line) => line.trim()).filter(Boolean)
  const tail: string[] = []
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index] ?? ""
    if (!/^\d+[.)]\s+\S/.test(line)) break
    tail.unshift(line)
  }
  if (tail.length < 2 || tail.length === lines.length) return false
  return tail.every((line, index) => line.startsWith(`${index + 1}`))
}

/** Customer-visible reply cut off before a complete sentence (output-token cap mid-JSON). */
export function isLikelyTruncatedBotReply(reply: string) {
  const body = bodyWithoutHeader(reply)
  if (body.length < 50) return false
  if (COMPLETE_REPLY_ENDING.test(body)) return false
  if (endsWithNumberedMenu(body)) return false
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
export function repairTruncatedBotReply(
  reply: string,
  options?: { skipCompletionTail?: boolean }
) {
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

  if (options?.skipCompletionTail) return repaired
  return `${repaired}\n\n${truncationCompletionTail(repaired)}`
}

export function customerTurnIncludedImage(content: string) {
  return /\[media:image:/i.test(content) || /\[תמונה\]/i.test(content)
}

export function lastCustomerTurnIncludedImage(history: { role: string; content: string }[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message?.role === "user") {
      return customerTurnIncludedImage(message.content)
    }
  }
  return false
}
