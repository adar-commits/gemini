import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { CONVERSATION_CONTRACTS } from "@/lib/hom-agent/contracts/registry"
import {
  assertCollisionPairDistinct,
  legislatorRouteForBranchList,
  legislatorRouteForBranchReview,
  legislatorRouteForDefect,
  legislatorRouteForDissatisfaction,
  legislatorRouteForOrderStatus,
  legislatorRouteForRefundTimeline,
  legislatorRouteForReturnLocation,
  legislatorRouteForReturnPolicy,
  legislatorRouteForReturnRequest,
  legislatorRouteForShippingPolicy,
} from "@/lib/hom-agent/contracts/replay"

/** Legislator: collision pairs from docs/intent-routing-audit.md must route differently. */
describe("legislator collision pairs", () => {
  it("refund_timeline vs return_location", () => {
    const left = "מסרתי בסניף, מתי אקבל החזר"
    const right = "איך מחזירים לסניף"
    assertCollisionPairDistinct(
      left,
      right,
      legislatorRouteForRefundTimeline(left),
      legislatorRouteForReturnLocation(right)
    )
  })

  it("branch_review_link vs branch_list", () => {
    const left = "לינק לדירוג סניף סגולה"
    const right = "איזה סניפים יש"
    assertCollisionPairDistinct(
      left,
      right,
      legislatorRouteForBranchReview(left),
      legislatorRouteForBranchList(right)
    )
  })

  it("return_policy vs return_request", () => {
    const left = "מה מדיניות החזרה"
    const right = "רוצה להחזיר את השטיח"
    assertCollisionPairDistinct(
      left,
      right,
      legislatorRouteForReturnPolicy(left),
      legislatorRouteForReturnRequest(right)
    )
  })

  it("order_status vs shipping_policy", () => {
    const left = "איפה ההזמנה שלי"
    const right = "כמה עולה משלוח"
    assertCollisionPairDistinct(
      left,
      right,
      legislatorRouteForOrderStatus(left),
      legislatorRouteForShippingPolicy(right)
    )
  })

  it("dissatisfaction vs defect", () => {
    const left = "לא ממש אוהב את השטיח"
    const right = "השטיח הגיע קרוע"
    assertCollisionPairDistinct(
      left,
      right,
      legislatorRouteForDissatisfaction(left),
      legislatorRouteForDefect(right)
    )
  })

  it("each collision side has a contract or gold coverage", () => {
    const contractIds = new Set(CONVERSATION_CONTRACTS.map((c) => c.id))
    const required = [
      "refund-timeline-vs-return-location",
      "branch-review-link",
      "branch-list-not-review",
      "return-policy-opening",
      "dissatisfaction-not-defect",
      "defect-not-dissatisfaction",
      "order-status-not-shipping-policy",
      "shipping-policy-not-order-status",
    ]
    for (const id of required) {
      assert.ok(contractIds.has(id), `missing contract for collision pair: ${id}`)
    }
  })
})
