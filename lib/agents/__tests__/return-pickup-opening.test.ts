import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  classifyPostPurchaseCase,
  isActiveReturnExchangePickupCase,
} from "@/lib/agents/inquiry-intent"
import { buildPostPurchaseIntentConfirm } from "@/lib/agents/intent-confirmation"
import {
  buildServiceHandoffConfirmReply,
  extractServiceIntake,
  needsServiceSummaryConfirm,
} from "@/lib/agents/service-intake"

const OPENING =
  "אני ממתין גבר שבועיים שיאספו ממני שטיח שרציתי להחזיר"

describe("return pickup opening message", () => {
  it("detects pickup wait even with filler between verb and action", () => {
    assert.equal(isActiveReturnExchangePickupCase(OPENING), true)
    assert.equal(classifyPostPurchaseCase(OPENING), "return_pickup_pending")
  })

  it("starts with intent confirm, not shipping lookup", () => {
    const reply = buildPostPurchaseIntentConfirm("return_pickup_pending", OPENING)
    assert.match(reply, /בקשת איסוף/)
    assert.match(reply, /אני צודק/)
    assert.doesNotMatch(reply, /מוכנה לאיסוף/)
  })

  it("builds service summary with wait duration and goal", () => {
    const intake = extractServiceIntake([], OPENING)
    assert.equal(intake.issueKind, "return_pickup_pending")
    assert.match(intake.waitDuration ?? "", /שבוע/)
    assert.equal(needsServiceSummaryConfirm(intake), true)

    const summary = buildServiceHandoffConfirmReply(intake)
    assert.match(summary, /לסיכום/)
    assert.match(summary, /איסוף מהבית/)
  })
})
