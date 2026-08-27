import { CUSTOMER_HEADER } from "@/lib/agents/types"

import { isPostPurchaseDissatisfaction } from "@/lib/agents/inquiry-intent"

/** Customer unhappy after delivery without defect wording — FAQ return/exchange policy first. */
export function isDissatisfactionWithoutDefect(body: string) {
  return isPostPurchaseDissatisfaction(body)
}

/** Exchange/return options first, then soft service handoff offer (rescue the sale). */
export function buildDissatisfactionRescueReply() {
  return `${CUSTOMER_HEADER}
מצטער לשמוע שהשטיח לא התחבר אליך.

ניתן להחליף מוצר שקיבלתם בסניפי הרשת, או להחזירו — בנקודות ההחזרה או באיסוף מהבית (בכפוף לתשלום).
פרטים מלאים: https://returns.carpetshop.co.il/
החלפה או החזרה — בתוך 14 יום מקבלת המוצר, כשהמוצר שלם וללא פגם או לכלוך.

אם זה לא פותר — אפשר להעביר לשירות לקוחות. רוצה?`
}
