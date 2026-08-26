import { CUSTOMER_HEADER } from "@/lib/agents/types"

import { isPostPurchaseDissatisfaction } from "@/lib/agents/inquiry-intent"

/** Unhappy with product/fit — routes to order lookup + service, not FAQ policy. */
export function isDissatisfactionWithoutDefect(body: string) {
  return isPostPurchaseDissatisfaction(body)
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
