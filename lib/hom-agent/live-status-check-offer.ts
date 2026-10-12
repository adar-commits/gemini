import type { HistoryMessage } from "@/lib/agents/types"

function botOfferedShippingProgressCheck(content: string) {
  const text = content.trim()
  return (
    /רוצ(?:ה|ים|ות)\s+ש(?:א|נ)?בדוק\s+באיזה\s+שלב/i.test(text) ||
    /(?:אבדוק|לבדוק)\s+באיזה\s+שלב\s+(?:נמצא(?:ת|ים)?\s+)?(?:ה)?הזמנה/i.test(text)
  )
}

/** Bot offered an immediate status lookup — not «זו ההזמנה?» card confirm (532858826). */
export function botOfferedLiveStatusCheck(content: string) {
  const text = content.trim()
  if (!text) return false
  if (botOfferedShippingProgressCheck(text)) return false
  return (
    /(?:יכול|אוכל|אני\s+יכול)\s+(?:ל)?בדוק.{0,80}(?:ה)?סטטוס/i.test(text) ||
    /(?:ל)?בדוק\s+ל(?:ך|כם)\s+עכשיו\s+א(?:ת\s+)?(?:ה)?סטטוס/i.test(text)
  )
}

function lastAssistantContent(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message?.role === "assistant") return message.content
  }
  return ""
}

export function isLiveStatusCheckOfferPending(history: HistoryMessage[]) {
  const last = lastAssistantContent(history)
  if (!last) return false
  return botOfferedLiveStatusCheck(last)
}

export function botAssistantOfferedKnownOrderCard(
  text: string,
  known: string,
  isOrderLookupIdentificationAsk: (content: string) => boolean
) {
  if (!text.includes(known)) return false
  if (botOfferedLiveStatusCheck(text) && !/\bזו\s+ה?הזמנה\b/i.test(text)) return false
  if (!/\?/.test(text)) return false
  return !isOrderLookupIdentificationAsk(text)
}

/** Affirmation after a live status-check offer (כן / כן בבקשה). */
export function isLiveStatusCheckAffirmation(body: string) {
  const text = body.trim()
  if (!text) return false
  if (/^כן(?:\s+|\s*,\s*)בבקשה(?:[\s,.!?]|$)/i.test(text)) return true
  if (/^כן/i.test(text) && /(?:בדוק|בבקשה|ממך)/i.test(text)) return true
  return /^כן/i.test(text) && text.length <= 48 && !/\bלא\b/.test(text)
}
