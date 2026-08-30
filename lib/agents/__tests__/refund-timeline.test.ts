import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isBranchListQuestion, isReturnToBranchQuestion } from "@/lib/agents/branches"
import { isRefundTimelineQuestion, isReturnPolicyQuestion } from "@/lib/agents/inquiry-intent"
import { buildRefundTimelinePolicyReply } from "@/lib/agents/policy-subjects"

const SCREENSHOT_MESSAGE =
  "שלום, אני מסרתי היום שטיח בחנות בסניף קריית אתא. מתי אני אקבל את ההחזר."

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
})
