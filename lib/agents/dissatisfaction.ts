import { CUSTOMER_HEADER } from "@/lib/agents/types"

import { isPostPurchaseDissatisfaction } from "@/lib/agents/inquiry-intent"
import { buildReturnPolicyBody } from "@/lib/agents/policy-subjects"

/** Customer unhappy after delivery without defect wording — FAQ return/exchange policy first. */
export function isDissatisfactionWithoutDefect(body: string) {
  return isPostPurchaseDissatisfaction(body)
}

/** Exchange/return options first, then soft service handoff offer (rescue the sale). */
export function buildDissatisfactionRescueReply() {
  return `${CUSTOMER_HEADER}
מצטער לשמוע שהשטיח לא התחבר אליך.

${buildReturnPolicyBody()}

אם זה לא פותר — אפשר להעביר לשירות לקוחות. רוצה?`
}
