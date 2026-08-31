import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isBranchListQuestion, isReturnToBranchQuestion } from "@/lib/agents/branches"
import {
  isRefundTimelineQuestion,
  isRefundStatusInquiry,
  isReturnPolicyQuestion,
} from "@/lib/agents/inquiry-intent"
import { buildRefundTimelinePolicyReply, buildRefundStatusHandoffReply } from "@/lib/agents/policy-subjects"
import { shouldHandlePostPurchaseCaseFlow } from "@/lib/agents/post-purchase-case"
import { requiresOrderIdentification } from "@/lib/agents/order-lookup"

const SCREENSHOT_MESSAGE =
  "שלום, אני מסרתי היום שטיח בחנות בסניף קריית אתא. מתי אני אקבל את ההחזר."

const REFUND_AFTER_PICKUP =
  "אספו את השטיח בשבוע שעבר. אפשר לדעת מה קורה עם ההחזר?"

describe("refund timeline vs branch return", () => {
  it("detects refund timing after branch drop-off", () => {
    assert.equal(isRefundTimelineQuestion(SCREENSHOT_MESSAGE), true)
    assert.equal(isReturnPolicyQuestion(SCREENSHOT_MESSAGE), true)
  })

  it("does not treat refund timing as branch-return or branch-list question", () => {
    assert.equal(isReturnToBranchQuestion(SCREENSHOT_MESSAGE), false)
    assert.equal(isBranchListQuestion(SCREENSHOT_MESSAGE), false)
  })

  it("still routes where-to-return questions to branches", () => {
    const whereToReturn = "איפה אפשר להחזיר שטיח לסניף קריית אתא?"
    assert.equal(isRefundTimelineQuestion(whereToReturn), false)
    assert.equal(isReturnToBranchQuestion(whereToReturn), true)
    assert.equal(isBranchListQuestion(whereToReturn), true)
  })

  it("answers with refund timeline policy, not branch addresses", () => {
    const reply = buildRefundTimelinePolicyReply()
    assert.match(reply, /7\s*ימי\s*עסקים/)
    assert.match(reply, /returns\.carpetshop\.co\.il/)
    assert.doesNotMatch(reply, /קריית אתא/)
    assert.doesNotMatch(reply, /כתובות\s+הסניפים/)
  })

  it("hands off post-pickup refund status to service without order lookup", () => {
    assert.equal(isRefundStatusInquiry(REFUND_AFTER_PICKUP), true)
    assert.equal(isRefundTimelineQuestion(REFUND_AFTER_PICKUP), false)
    assert.equal(shouldHandlePostPurchaseCaseFlow(REFUND_AFTER_PICKUP, [], null), false)
    assert.equal(requiresOrderIdentification(REFUND_AFTER_PICKUP), false)
    const reply = buildRefundStatusHandoffReply()
    assert.match(reply, /נציג שירות/)
    assert.match(reply, /סטטוס ההחזר/)
    assert.doesNotMatch(reply, /מספר ההזמנה/)
    assert.doesNotMatch(reply, /האם היא רשומה/)
  })
})
