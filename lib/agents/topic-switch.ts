/** Mid-conversation pivot from sales/service into FAQ policy answers. */
export function isFaqTopicSwitch(body: string) {
  const text = body.trim()
  if (!text) return false

  if (
    /(?:איך\s+מ(?:חזיר|בטל)|מדיניות|תקנון|פורטל\s+החזר)/i.test(text) ||
    /(?:^|\s)(?:החזר(?:ה|ות)?|להחזיר|החלפ(?:ה|ות)?|ביטול|זיכוי)(?:\s|$|[?.!,])/i.test(text) ||
    /(?:ואם|what\s+if).*(?:החזיר|החלפ|ביטול|תחרט|אחר(?:י)?)/i.test(text) ||
    /(?:החזיר|להחזיר).*(?:תחרט|בטעות)/i.test(text) ||
    /(?:איזה|מה\s+ה|רשימ(?:ת|ה)\s+)?(?:ה)?סניפ|סניפים\s+יש|לסניף|כתובות?\s+(?:ה)?סניפ/i.test(
      text
    ) ||
    /שעות\s+(?:פעילות|פתיחה)|מתי\s+פתוח/i.test(text) ||
    /אמצעי\s+תשלום|תשלומים|משלוח\s+חינם/i.test(text)
  ) {
    return true
  }

  return false
}

/** Short affirmative answer during sales quiz — not a topic switch. */
export function isSalesQuizAffirmation(body: string) {
  return /^(כן|נכון|בדיוק|מדויק|yes|זה\s+נכון|זה\s+בדיוק)/i.test(body.trim())
}
