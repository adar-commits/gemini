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
