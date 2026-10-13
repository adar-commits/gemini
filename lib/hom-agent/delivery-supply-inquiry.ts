/** Site/tracking shows in transit but no SMS or courier contact yet (534760699). */
export function isInTransitTrackingNotificationGap(body: string) {
  const text = body.trim()
  if (!text) return false
  return (
    /(?:רשום|מופיע|כתוב|מראה|רוא(?:ה|ים))/.test(text) &&
    /(?:בדרך|נשלח|יצא\s+ל(?:משלוח|שליח))/.test(text) &&
    /(?:ה)?הזמנה/.test(text) &&
    /(?:לא\s+קיבלתי|לא\s+יצרו|לא\s+התקשר|לא\s+עדכנ)/.test(text)
  )
}

/** "לברר לגבי אספקה/אספקת הזמנה" — delivery status ask without explicit מתי/סטטוס (534252170). */
export function isDeliverySupplyInquiry(body: string) {
  const text = body.trim()
  if (!text) return false
  if (
    /(?:רוצ(?:ה|ים|ות)|(?:א)?שמח(?:ה|ים)?)\s+(?:ל)?(?:ברר|לברר)\s+לגבי\s+(?:ה)?(?:אספק(?:ה|ת)|משלוח)/i.test(
      text
    )
  ) {
    return true
  }
  return (
    /(?:ל)?(?:ברר|לברר)\s+לגבי\s+(?:ה)?(?:אספק(?:ה|ת)|משלוח)/i.test(text) &&
    /(?:ה)?זמנה|האספק(?:ה|ת)\s+של/i.test(text)
  )
}
