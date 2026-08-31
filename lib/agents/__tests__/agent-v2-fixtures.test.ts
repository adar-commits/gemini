import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import {
  isCantVisitBranchReturnHelp,
  isRefundStatusInquiry,
  isWarehouseShipRequest,
} from "@/lib/agents/inquiry-intent"
import { isBranchListQuestion } from "@/lib/agents/branches"
import {
  isOrderConfirmationYes,
  isServiceLookupContext,
  isShippingLookupContext,
} from "@/lib/agents/order-lookup"
import { shouldHandlePostPurchaseCaseFlow } from "@/lib/agents/post-purchase-case"
import { buildCantVisitBranchReturnReply, buildWarehouseShipHandoffReply } from "@/lib/agents/policy-subjects"
import { guessMasterRoute } from "@/lib/agents/route-intent"
import { isShippingStatusQuestion } from "@/lib/agents/shipping"

const REFUND_AFTER_PICKUP =
  "אספו את השטיח בשבוע שעבר. אפשר לדעת מה קורה עם ההחזר?"

const WAREHOUSE_SHIP = "מבקשת לשלוח שטיח באחסנה"

const CANT_VISIT_BRANCH = "לא יכולה להגיע לסניף, השטיח כבד מאוד"

describe("agent v2 routing fixtures", () => {
  it("detects refund status after pickup without shipping lookup", () => {
    assert.equal(isRefundStatusInquiry(REFUND_AFTER_PICKUP), true)
    assert.equal(isShippingLookupContext(REFUND_AFTER_PICKUP, []), false)
  })

  it("detects warehouse ship and cant-visit-branch intents", () => {
    assert.equal(isWarehouseShipRequest(WAREHOUSE_SHIP), true)
    assert.equal(isCantVisitBranchReturnHelp(CANT_VISIT_BRANCH), true)
    assert.equal(isBranchListQuestion(CANT_VISIT_BRANCH), false)
    assert.equal(guessMasterRoute(WAREHOUSE_SHIP), "ROUTE_TO_SERVICE_AGENT")
    assert.equal(guessMasterRoute(CANT_VISIT_BRANCH), "ROUTE_TO_INFO_AGENT")
  })

  it("policy replies for new T0 intents", () => {
    assert.match(buildWarehouseShipHandoffReply(), /נציג שירות/)
    assert.match(buildCantVisitBranchReturnReply(), /איסוף מהבית/)
    assert.doesNotMatch(buildCantVisitBranchReturnReply(), /כתובות\s+הסניפים/)
  })

  it("accepts אמת and אוקיי as order confirmation", () => {
    assert.equal(isOrderConfirmationYes("אמת"), true)
    assert.equal(isOrderConfirmationYes("אוקיי"), true)
    assert.equal(isOrderConfirmationYes("סבבה"), true)
  })

  it("service thread keeps lookup — shipping does not hijack phone confirm", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: REFUND_AFTER_PICKUP },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nאני מבין שהשטיח כבר נאסף ומחכים לעדכון על ההחזר.\nמה מספר ההזמנה?",
      },
      { role: "user", content: "לא יודעת" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nאוקיי, האם הטלפון 0547-495083 שבוצעה עליו ההזמנה?",
      },
    ]

    assert.equal(isServiceLookupContext(history, "service"), true)
    assert.equal(isShippingLookupContext("0547495083", history, "service"), false)
    assert.equal(shouldHandlePostPurchaseCaseFlow("0547495083", history, "service"), true)
    assert.equal(isShippingLookupContext("0547495083", history, "service"), false)
  })

  it("shipping lookup still works for status questions without service context", () => {
    const body = "איפה המשלוח שלי"
    assert.equal(isShippingStatusQuestion(body), true)
    assert.equal(isShippingLookupContext(body, []), true)
  })
})
