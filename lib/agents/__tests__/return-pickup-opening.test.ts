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
  needsServiceSummaryConfirm,
} from "@/lib/agents/service-intake"

const OPENING =
  "אני ממתין גבר שבועיים שיאספו ממני שטיח שרציתי להחזיר"

describe("return pickup opening message", () => {
  it("detects pickup wait even with filler between verb and action", () => {
    assert.equal(isActiveReturnExchangePickupCase(OPENING), true)
    assert.equal(classifyPostPurchaseCase(OPENING), "return_pickup_pending")
  })

  it("starts with service summary handoff, not shipping lookup", () => {
    const intake = extractServiceIntake([], OPENING)
    intake.issueKind = "return_pickup_pending"
    const reply = buildReturnPickupAwaitingServiceReply(intake, OPENING)
    assert.match(reply, /כבר פתחתם בקשת החזרה/)
    assert.match(reply, /לסיכום לנציג/)
    assert.doesNotMatch(reply, /מוכנה לאיסוף/)
    assert.doesNotMatch(reply, /מה מספר ההזמנה/)
  })

  it("builds service summary with wait duration and goal", () => {
    const intake = extractServiceIntake([], OPENING)
    assert.equal(intake.issueKind, "return_pickup_pending")
    assert.match(intake.waitDuration ?? "", /שבוע/)
    assert.equal(needsServiceSummaryConfirm(intake), true)

    const summary = buildServiceHandoffConfirmReply(intake)
    assert.match(summary, /לסיכום/)
    assert.match(summary, /בקשת החזרה/)
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
