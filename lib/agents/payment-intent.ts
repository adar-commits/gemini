/** Checkout / payment with membership, gift card, or reloadable benefit card. */
export function isMembershipClubCheckoutQuestion(body: string) {
  const text = body.trim()
  if (!text || text.length > 240) return false
  return (
    /כרטיס\s+נטען|מועדון|גיפט|gift\s*card|שובר|buyme|buy\s*me|לאומי\s+בונוס|istudent|מגה\s+לאן|דולצ(?:'|׳|')?ה|דולצה/i.test(
      text
    ) ||
    /(?:להשלים|לסגור|לשלם|לפרוע).{0,40}(?:הזמנ|רכיש|קנ(?:י|י)ה|באתר)/i.test(text) ||
    /(?:באמצעות|ע(?:ם|״|")?\s*כרטיס).{0,30}(?:נטען|מועדון|חבר|פיס|buyme)/i.test(text)
  )
}
