import type { HistoryMessage } from "@/lib/agents/types"

/** Customer-facing close when they say it has not arrived after an en-route status. */
export const EN_ROUTE_NOT_YET_ARRIVED_REPLY =
  "ייתכנו עיכובים, אבל זה הסטטוס הסופי והמשלוח אמור להגיע ממש בקרוב. השליח יתקשר רגע לפני ההגעה."

function assistantReportedEnRoute(history: HistoryMessage[]) {
  return history.some(
    (message) =>
      message.role === "assistant" &&
      /בדקתי/.test(message.content) &&
      /הועמס לשליח|בדרכו אליך|אצל השליח/.test(message.content)
  )
}

/**
 * Thread already told them the shipment is on the way, and this turn only
 * updates that it has not arrived. Not a postponement request and not a new ETA ask.
 */
export function isEnRouteNotYetArrivedUpdate(body: string, history: HistoryMessage[]) {
  if (!assistantReportedEnRoute(history)) return false
  const text = body.trim()
  if (!text || text.length > 80) return false
  if (/דחי|מיום|לבטל|החזר|נציג|מתי|צפי/.test(text)) return false
  return /טרם\s+הגיע|עוד\s+לא\s+הגיע|עדיין\s+לא\s+הגיע|(?:^|\s)לא\s+הגיע|טרם\s+קיבל/.test(
    text
  )
}
