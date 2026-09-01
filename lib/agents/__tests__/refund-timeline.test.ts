import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isBranchListQuestion, isReturnToBranchQuestion } from "@/lib/agents/branches"
import {
  isRefundTimelineQuestion,
  isRefundStatusInquiry,
  isReturnPolicyQuestion,
} from "@/lib/agents/inquiry-intent"
import { buildRefundTimelinePolicyReply, buildRefundStatusHandoffReply, sanitizeRefundPolicyWording } from "@/lib/agents/policy-subjects"
import { requiresOrderIdentification, isServiceLookupContext } from "@/lib/agents/order-lookup"
import type { HistoryMessage } from "@/lib/agents/types"

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
    assert.match(reply, /ממועד ביטול העסקה/)
    assert.match(reply, /returns\.carpetshop\.co\.il/)
    assert.doesNotMatch(reply, /תוך\s+עד/)
    assert.doesNotMatch(reply, /קריית אתא/)
    assert.doesNotMatch(reply, /כתובות\s+הסניפים/)
  })

  it("post-pickup refund status is service lookup, not timeline FAQ", () => {
    assert.equal(isRefundStatusInquiry(REFUND_AFTER_PICKUP), true)
    assert.equal(isRefundTimelineQuestion(REFUND_AFTER_PICKUP), false)
    assert.equal(requiresOrderIdentification(REFUND_AFTER_PICKUP), false)

    const history: HistoryMessage[] = [
      { role: "user", content: REFUND_AFTER_PICKUP },
      {
        role: "assistant",
        content: "*הום בוט :)*\nמה מספר ההזמנה?",
      },
    ]
    assert.equal(isServiceLookupContext(history, "service"), true)

    const reply = buildRefundStatusHandoffReply()
    assert.match(reply, /עד 7 ימי עסקים ממועד ביטול העסקה/)
    assert.match(reply, /נציג שירות/)
    assert.match(reply, /סטטוס/)
    assert.doesNotMatch(reply, /תוך\s+עד/)
    assert.doesNotMatch(reply, /מחסן/)
    assert.doesNotMatch(reply, /מספר ההזמנה/)
    assert.doesNotMatch(reply, /האם היא רשומה/)
  })

  it("sanitizes LLM refund wording drift", () => {
    const fixed = sanitizeRefundPolicyWording(
      "ההחזר מתבצע תוך עד 7 ימי עסקים מרגע שהמוצר מגיע חזרה למחסן."
    )
    assert.match(fixed, /עד 7 ימי עסקים/)
    assert.match(fixed, /ממועד ביטול העסקה/)
    assert.doesNotMatch(fixed, /תוך\s+עד/)
    assert.doesNotMatch(fixed, /מחסן/)
  })
})
