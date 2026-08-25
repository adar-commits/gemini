import { CUSTOMER_HEADER } from "@/lib/agents/types"

/** Unhappy with product/fit — no defect, missing item, or explicit return request yet. */
export function isDissatisfactionWithoutDefect(body: string) {
  const text = body.trim()
  if (!text) return false

  if (
    /קרוע|פגום|שבור|סדוק|לא\s+קיבלתי|חסר(ים)?\s+ב|מוצר\s+לא\s+נכון|טעות\s+ב(?:ה)?זמנה/i.test(
      text
    )
  ) {
    return false
  }

  return (
    /לא\s+מרוצ|לא\s+מתאים|לא\s+אהב|לא\s+כ(?:\"|״|')?כ/i.test(text) ||
    /(?:קיבלתי|הגיע).*(?:לא\s+מרוצ|לא\s+מתאים|לא\s+אהב)/i.test(text)
  )
}

/** Exchange/return options first, then soft service handoff offer (rescue the sale). */
export function buildDissatisfactionRescueReply() {
  return `${CUSTOMER_HEADER}
ניתן להחליף מוצר שקיבלתם בסניפי הרשת, או להחזירו — בנקודות ההחזרה או באיסוף מהבית (בכפוף לתשלום).
פרטים מלאים: https://returns.carpetshop.co.il/
החלפה או החזרה — בתוך 14 יום מקבלת המוצר, כשהמוצר שלם וללא פגם או לכלוך.

אפשר לעזור במשהו נוסף? כדי להתחיל מחדש, כתבו "התחלה".

כדי לבדוק את המקרה באופן פרטני, האם להעביר את הפנייה להמשך טיפול בשירות הלקוחות?`
}
