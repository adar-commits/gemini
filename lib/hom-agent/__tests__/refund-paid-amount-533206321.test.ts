import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildConversationHints,
  isRefundActualPaidAmountQuestion,
} from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

function history533206321(): HistoryMessage[] {
  return [
    { role: "user", content: "170/120 הזמנתי" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* תודה תמר, רשמתי את המידה בפנייה: שטיח ניבה 120*170, הזמנה 76604. במידה הזו איסוף שליח מהבית עולה 85 ₪.",
    },
    { role: "user", content: "אז לא הבנתי איך בוצע חישוב ההחזר אלה המחירים באתר" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* תמר, קיבלתי את צילום המסך. ההחזר מחושב לפי הסכום ששילמת בפועל בהזמנה 76604, ולא לפי המחיר שמופיע היום באתר. המחיר באתר (294 ₪ אחרי 40% הנחה) הוא מחיר המבצע הנוכחי.",
    },
  ]
}

describe("refund paid amount clarification (533206321)", () => {
  it("detects actual paid amount question after refund calculation explanation", () => {
    const body = "מה המחיר ששילמתי בפועל?\nולמה שיהיה שונה מעכשיו"
    assert.equal(isRefundActualPaidAmountQuestion(history533206321(), body), true)
  })

  it("emits lookup hint and blocks refund status handoff pivot", () => {
    const body = "מה המחיר ששילמתי בפועל?\nולמה שיהיה שונה מעכשיו"
    const hints =
      buildConversationHints({
        history: history533206321(),
        body,
      }) ?? ""
    assert.match(hints, /REFUND PAID AMOUNT CLARIFICATION \(533206321\)/)
    assert.match(hints, /lookup_order_status/)
    assert.doesNotMatch(hints, /REFUND STATUS FOLLOW-UP \(295276261\)/)
    assert.match(hints, /never.*human_service/i)
  })
})
