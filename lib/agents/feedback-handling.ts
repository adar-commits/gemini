import { CUSTOMER_HEADER } from "@/lib/agents/types"

export function googleMapsReviewUrl() {
  return process.env.GOOGLE_MAPS_REVIEW_URL?.trim() || ""
}

export function isServicePraise(body: string) {
  const text = body.trim()
  if (!text || text.length > 300) return false

  return (
    /פרגון\s+ע(?:ל|ם)\s+שירות|שירות\s+(?:מעולה|טוב|נהדר|מצוין)/i.test(text) ||
    /(?:תודה|תוד(?:ה|ו)\s+רב(?:ה)?).*(?:נציג|שירות\s+טוב|שירות\s+מעולה)/i.test(text) ||
    /(?:נציג|שירות)\s+(?:מעולה|נהדר|מצוין|טוב\s+מאוד)/i.test(text) ||
    /מ(?:רוצ|רוצה)\s+(?:מ|מה)(?:נציג|שירות)/i.test(text)
  )
}

export function buildServicePraiseReply() {
  const reviewUrl = googleMapsReviewUrl()
  const reviewLine = reviewUrl
    ? `\nאם תרצו/י — נשמח לביקורת ב-Google:\n${reviewUrl}`
    : ""

  return `${CUSTOMER_HEADER}
תודה רבה על המילים החמות — שמחנו לעזור.${reviewLine}

אפשר לעזור במשהו נוסף?`
}

export function isWebsiteIssueComplaint(body: string) {
  const text = body.trim()
  if (!text) return false

  return (
    /תקל(?:ה|ות)\s+ב(?:אתר|אפליק)|האתר\s+לא\s+(?:עובד|נטען|נפתח)|באג\s+ב(?:אתר|אפליק)|bug/i.test(
      text
    ) ||
    /(?:לא\s+(?:מצליח|מצליחה)|אי\s+אפשר)\s+(?:ל)?(?:להזמין|לקנות|לשלם).*?(?:אתר|אונליין)/i.test(
      text
    )
  )
}

export function buildWebsiteIssueHandoffOffer() {
  return `${CUSTOMER_HEADER}
מבינים — תקלה באתר דורשת טיפול של צוות טכני.
האם להעביר את הפנייה כעת לנציג שירות שיטפל בזה?`
}
