import { CUSTOMER_HEADER, type HistoryMessage } from "@/lib/agents/types"

const TRACKING_URL_RE =
  /https:\/\/tracking\.carpetshop\.co\.il\/track\?[^?\s#]*orderID=[A-Za-z0-9]+/i

/** Customer asks where the tracking link is — not a status check about the page. */
export function isTrackingLinkLocationQuestion(body: string) {
  const text = body.trim()
  if (!text || text.length > 90) return false
  return /(?:איפה|היכן|שלח|תשלח|אפשר).{0,30}(?:קישור|לינק).{0,20}מעקב/i.test(text)
}

export function trackingUrlFromThread(history: HistoryMessage[]) {
  for (const message of history) {
    const match = message.content.match(TRACKING_URL_RE)
    if (match?.[0]) return match[0]
  }
  return null
}

export function buildTrackingLinkReply(url: string) {
  return `${CUSTOMER_HEADER}
הנה קישור המעקב:
${url}`
}
