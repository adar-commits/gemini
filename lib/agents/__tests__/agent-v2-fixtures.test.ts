import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import {
  isCantVisitBranchReturnHelp,
  isRefundStatusInquiry,
  isRefundTimelineQuestion,
  isWarehouseShipRequest,
} from "@/lib/agents/inquiry-intent"
import { isBranchListQuestion } from "@/lib/agents/branches"
import {
  isOrderConfirmationYes,
  isServiceLookupContext,
  isShippingLookupContext,
} from "@/lib/agents/order-lookup"
import { buildCantVisitBranchReturnReply, buildWarehouseShipHandoffReply } from "@/lib/agents/policy-subjects"
import { isShippingStatusQuestion } from "@/lib/agents/shipping"
import { validateHomAgentReply } from "@/lib/hom-agent/validate-reply"
import { usesHomAgentV3 } from "@/lib/hom-agent/engine"

const REFUND_AFTER_PICKUP =
  "אספו את השטיח בשבוע שעבר. אפשר לדעת מה קורה עם ההחזר?"

const WAREHOUSE_SHIP = "מבקשת לשלוח שטיח באחסנה"

const CANT_VISIT_BRANCH = "לא יכולה להגיע לסניף, השטיח כבד מאוד"

describe("hom-agent v3 fixtures", () => {
  it("uses v3 engine by default", () => {
    assert.equal(usesHomAgentV3(), true)
  })

  it("detects refund status after pickup without shipping lookup", () => {
    assert.equal(isRefundStatusInquiry(REFUND_AFTER_PICKUP), true)
    assert.equal(isShippingLookupContext(REFUND_AFTER_PICKUP, []), false)
  })

  it("refund timeline vs return location must-not-match", () => {
    assert.equal(isRefundTimelineQuestion("מסרתי בסניף, מתי אקבל החזר?"), true)
    assert.equal(isBranchListQuestion("מסרתי בסניף, מתי אקבל החזר?"), false)
    assert.equal(isBranchListQuestion("איך מחזירים לסניף?"), true)
    assert.equal(isRefundTimelineQuestion("איך מחזירים לסניף?"), false)
  })

  it("detects warehouse ship and cant-visit-branch intents", () => {
    assert.equal(isWarehouseShipRequest(WAREHOUSE_SHIP), true)
    assert.equal(isCantVisitBranchReturnHelp(CANT_VISIT_BRANCH), true)
    assert.equal(isBranchListQuestion(CANT_VISIT_BRANCH), false)
  })

  it("policy replies for warehouse ship and cant-visit-branch", () => {
    assert.match(buildWarehouseShipHandoffReply(), /נציג שירות/)
    assert.match(buildCantVisitBranchReturnReply(), /איסוף מהבית/)
    assert.doesNotMatch(buildCantVisitBranchReturnReply(), /כתובות\s+הסניפים/)
  })

  it("accepts אמת and אוקיי as order confirmation", () => {
    assert.equal(isOrderConfirmationYes("אמת"), true)
    assert.equal(isOrderConfirmationYes("אוקיי"), true)
    assert.equal(isOrderConfirmationYes("נכון"), true)
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
    assert.equal(isShippingLookupContext("0547495083", history, "service"), false)
  })

  it("pickup wait + נכון must not produce sales handoff text", () => {
    const output = validateHomAgentReply(
      {
        reply: "*הום בוט :)*\nאני בודק את סטטוס ההחזר לפי ההזמנה.",
        action: "reply",
      },
      "נכון"
    )
    assert.doesNotMatch(output.reply, /יועץ מכירות/)
    assert.doesNotMatch(output.reply, /מכירות ועיצוב/)
  })

  it("shipping lookup still works for status questions without service context", () => {
    const body = "איפה המשלוח שלי"
    assert.equal(isShippingStatusQuestion(body), true)
    assert.equal(isShippingLookupContext(body, []), true)
  })
})
