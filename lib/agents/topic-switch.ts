import {
  isShippingPolicyQuestion,
  isShippingStatusQuestion,
} from "@/lib/agents/shipping"

export { isShippingPolicyQuestion, isShippingStatusQuestion }

/** Mid-conversation pivot from sales/service into FAQ policy answers. */
export function isFaqTopicSwitch(body: string) {
  const text = body.trim()
  if (!text) return false

  if (isShippingPolicyQuestion(text)) return true

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

/** Pivot into post-purchase service handling. */
export function isServiceTopicSwitch(body: string) {
  const text = body.trim()
  if (!text) return false

  if (
    /קרוע|פגום|שבור|סדוק|תלונה|לא\s+מרוצ|לא\s+אהב|לא\s+מתאים/i.test(text) ||
    /לא\s+קיבלתי|מוצר\s+לא\s+נכון|חסר(ים)?\s+ב|הגיע\s+(קרוע|פגום|שבור|לא\s+נכון)/i.test(text) ||
    /חייב(?:ו|ת)?\s+אותי|חשבונית|קבלה|זיכוי\s+לא\s+הופיע|טעות\s+בחיוב/i.test(text) ||
    /(?:ה)?זמנה\s+קיימ|בעיה\s+ע(?:ם|ם)\s+(?:ה)?הזמנה|נציג\s+שירות/i.test(text)
  ) {
    return true
  }

  return false
}

/** Pivot into general purchase consultation (not specific model/stock — those use human handoff). */
export function isSalesTopicSwitch(body: string) {
  const text = body.trim()
  if (!text) return false

  if (
    /רוצ(?:ה|ים|ות)\s+לקנות|מחפש(?:ים|ת|ים)?\s+(?:שטיח|פוף|תמונ|אביזר)/i.test(text) ||
    /תקציב|עד\s+[\d,]+|ייעוץ\s+עיצוב|עוזר\s+לבחור|מתלבט/i.test(text) ||
    /שטיח\s+ל(סלון|חדר|מטבח|כניסה|מרפסת)/i.test(text) ||
    /(?:כמה\s+עולה|מחיר\s+של)(?!.*(?:במלאי|דגם\s+\S+|קזבל|גארד|מילאן))/i.test(text)
  ) {
    return true
  }

  return false
}

/** Short affirmative answer during sales quiz — not a topic switch. */
export function isSalesQuizAffirmation(body: string) {
  return /^(כן|נכון|בדיוק|מדויק|yes|זה\s+נכון|זה\s+בדיוק)/i.test(body.trim())
}
