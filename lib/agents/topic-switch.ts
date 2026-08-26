import {
  isShippingPolicyQuestion,
  isShippingStatusQuestion,
} from "@/lib/agents/shipping"
import { isCustomerServiceOpener } from "@/lib/agents/customer-service-opener"
import { isFaqPolicyQuestion } from "@/lib/agents/policy-subjects"

export { isFaqPolicyQuestion } from "@/lib/agents/policy-subjects"

export { isShippingPolicyQuestion, isShippingStatusQuestion }

/** Customer explicitly pivots away from the current flow. */
export function isTopicPivotPhrase(body: string) {
  const text = body.trim()
  if (!text) return false
  return /^(?:רגע|רגע\s+לפני\s+זה|אגב|בינתיים|לפני\s+זה|שאלה\s+אחרת|עוד\s+שאלה)/i.test(text)
}

/** Mid-conversation pivot from sales/service into FAQ policy answers. */
export function isFaqTopicSwitch(body: string) {
  const text = body.trim()
  if (!text) return false

  if (isShippingPolicyQuestion(text)) return true
  if (isFaqPolicyQuestion(text)) return true

  return false
}

/** Active post-purchase case needing human CS — not policy-only questions. */
export function isServiceTopicSwitch(body: string) {
  const text = body.trim()
  if (!text) return false

  if (isCustomerServiceOpener(text)) return false

  if (
    /(?:הזמנה\s+)?מוקדמת|pre\s*-?\s*order|עיכוב.*מכולה|משלוח\s+חסר|תלונה\s+על\s+(?:שליח|זמנים)|פגם\s+ב(?:ה)?ובלה|טעות\s+בליקוט|זליג(?:ה|ת)\s+צבע/i.test(
      text
    ) ||
    /(?:קיבלתי|הגיע(?:ה|ו)?).*(?:פגם|פגום|קרוע|שבור|ליקוי)/i.test(text) ||
    /(?:יש|קיים)\s+(?:ב(?:ו|ה|הם)?\s+)?(?:פגם|ליקוי)/i.test(text) ||
    /לא\s+קיבלתי|מוצר\s+לא\s+נכון|חסר(ים)?\s+ב|הגיע\s+(קרוע|פגום|שבור|לא\s+נכון)/i.test(text) ||
    /חייב(?:ו|ת)?\s+אותי|חשבונית|קבלה|זיכוי\s+לא\s+הופיע|טעות\s+בחיוב/i.test(text) ||
    /לא\s+עונים|התאמת\s+מחיר|ו?זיכוי\s+כספי|לגבי\s+(?:ה)?זיכוי|מקווה\s+שנסגור|מבצע.*\d+\s*%|לא\s+מה\s+שדיברנו/i.test(text) ||
    /(?:ה)?זמנה\s+קיימ|בעיה\s+ע(?:ם|ם)\s+(?:ה)?הזמנה/i.test(text) ||
    /(?:ה)?זמנה\s+#?\d{4,}|#\d{4,}-\s*/i.test(text) ||
    /(?:ל)?שנ(?:ות|ה)\s+(?:א(?:ת|ת)?\s+)?(?:ה)?(?:שטיח|גודל|מידה|הזמנה)|טעיתי\s+ב(?:גודל|מידה)/i.test(
      text
    ) ||
    /(?:שימ(?:י|ו)|ת(?:שימ|שימ)י).*(?:בגינה|ליד|מעבר)|לא\s+אהיה\s+בבית|(?:ת(?:יאום|צר(?:ו|י)\s+קשר)|אספק(?:ה|ת)).*(?:שטיח|משלוח|הזמנה)/i.test(
      text
    ) ||
    /(?:עדיין\s+לא|אף\s+אחד\s+לא)\s+(?:יצר|הגיע|לקח|קיבל|אספ(?:ק|קו))/i.test(text) ||
    /(?:לא\s+הבנתי|לא\s+י(?:צר|צא)).*(?:א(?:ספקה|ספק)|משלוח|הזמנה)/i.test(text) ||
    /(?:להוסיף|לשנות|לבטל).*(?:להזמנה|בהזמנה|ברכישה)/i.test(text)
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
