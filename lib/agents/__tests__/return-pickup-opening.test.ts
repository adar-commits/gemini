import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  classifyPostPurchaseCase,
  isActiveReturnExchangePickupCase,
} from "@/lib/agents/inquiry-intent"
import type { HistoryMessage } from "@/lib/agents/types"
import {
  buildReturnPickupAwaitingServiceReply,
  buildServiceHandoffConfirmReply,
  extractServiceIntake,
  isReturnPickupAwaitingThread,
  isServiceHandoffSummaryPending,
  isServiceHandoffSummaryText,
  needsServiceSummaryConfirm,
  salvageReturnPickupAwaitingReply,
} from "@/lib/agents/service-intake"

const OPENING =
  "אני ממתין גבר שבועיים שיאספו ממני שטיח שרציתי להחזיר"

const EXACT_PRODUCTION_OPENING =
  "אני ממתין כבר שבועיים שיאספו ממני שטיח שרציתי להחזיר"

describe("return pickup opening message", () => {
  it("detects exact production opener without filler words", () => {
    assert.equal(isActiveReturnExchangePickupCase(EXACT_PRODUCTION_OPENING), true)
    assert.equal(classifyPostPurchaseCase(EXACT_PRODUCTION_OPENING), "return_pickup_pending")
  })

  it("salvages service summary when the main pipeline returns empty", () => {
    const reply = salvageReturnPickupAwaitingReply(EXACT_PRODUCTION_OPENING)
    assert.ok(reply)
    assert.match(reply!, /בקשת ההחזרה כבר פתוחה/)
    assert.equal(isServiceHandoffSummaryText(reply!), true)
    assert.match(reply!, /נוצרה בקשת איסוף/)
  })

  it("detects pickup wait even with filler between verb and action", () => {
    assert.equal(isActiveReturnExchangePickupCase(OPENING), true)
    assert.equal(classifyPostPurchaseCase(OPENING), "return_pickup_pending")
  })

  it("starts with service summary handoff, not shipping lookup", () => {
    const intake = extractServiceIntake([], OPENING)
    intake.issueKind = "return_pickup_pending"
    const reply = buildReturnPickupAwaitingServiceReply(intake, OPENING)
    assert.match(reply, /בקשת ההחזרה כבר פתוחה/)
    assert.match(reply, /מצטער על ההמתנה/)
    assert.equal(isServiceHandoffSummaryPending([{ role: "assistant", content: reply }]), true)
    assert.match(reply, /נוצרה בקשת איסוף/)
    assert.doesNotMatch(reply, /מוכנה לאיסוף/)
    assert.doesNotMatch(reply, /מה מספר ההזמנה/)
  })

  it("builds service summary with wait duration and goal", () => {
    const intake = extractServiceIntake([], OPENING)
    assert.equal(intake.issueKind, "return_pickup_pending")
    assert.match(intake.waitDuration ?? "", /שבוע/)
    assert.equal(needsServiceSummaryConfirm(intake), true)

    const summary = buildServiceHandoffConfirmReply(intake, OPENING)
    assert.equal(isServiceHandoffSummaryText(summary), true)
    assert.match(summary, /זה מדויק, או שחסר משהו\?/)
    assert.match(summary, /נוצרה בקשת איסוף/)
    assert.match(summary, /סטטוס איסוף/)
  })

  it("detects return pickup thread from phone reply after wrong LLM derail", () => {
    const history: HistoryMessage[] = [
      {
        role: "user",
        content: OPENING,
      },
      {
        role: "assistant",
        content: "מה מספר ההזמנה או שאבדוק לפי הטלפון?",
      },
    ]
    assert.equal(
      isReturnPickupAwaitingThread(history, "כן זה הטלפון שלי"),
      true
    )
  })
})
