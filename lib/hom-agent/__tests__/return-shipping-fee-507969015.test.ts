import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  classifyPostPurchaseCase,
  isReturnPolicyQuestion,
  isReturnShippingFeeQuestion,
} from "@/lib/agents/inquiry-intent"
import { isReturnExchangePolicyFaqQuestion } from "@/lib/agents/policy-subjects"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

/** Replay 508186555 / 0524247266 — return courier fee FAQ must not hand off to rep. */
describe("return shipping fee FAQ (507969015)", () => {
  const opening =
    "הזמנתי שטיח שעוד לא הגיע ואני רוצה לבטל.\nהוא לא יתאים לי במידות. עשיתי טעות"

  const feeQuestion =
    "אני אשמח לדעת כמה יעלה לי אם קודם אקבל אותו הביתה ואז אתחרט. כמה דמי משלוח\nכן כן"

  const history: HistoryMessage[] = [
    { role: "user", content: opening },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nאוקיי נדמה לי שמצאתי את ההזמנה, בוצעה לפני יומיים באתר אינטרנט על סך 220 ש׳׳ח נכון? (מס׳ הזמנה #76905)",
    },
  ]

  it("detects return shipping fee and pre-delivery cancel as policy FAQ", () => {
    assert.equal(isReturnShippingFeeQuestion(feeQuestion), true)
    assert.equal(isReturnPolicyQuestion(feeQuestion), true)
    assert.equal(isReturnExchangePolicyFaqQuestion(feeQuestion), true)
    assert.equal(isReturnPolicyQuestion(opening), true)
    assert.equal(classifyPostPurchaseCase(opening), "dissatisfaction")
  })

  it("hints KB fee answer and blocks after-hours handoff override", () => {
    const hints = buildConversationHints({
      body: feeQuestion,
      history: [
        ...history,
        {
          role: "assistant",
          content:
            "*הום בוט :)*\nאם אין את המספר בהישג יד — אפשר גם להעביר את הפנייה לנציג… להעביר?",
        },
      ],
      whatsappPhone: "0524247266",
    })

    assert.match(hints ?? "", /RETURN SHIPPING FEE FAQ/i)
    assert.match(hints ?? "", /85.*300|NOT human_service/i)
    assert.match(hints ?? "", /HANDOFF OFFER STALE|RETURN FAQ THIS TURN/i)
    assert.doesNotMatch(hints ?? "", /HANDOFF OFFER PENDING/i)
    assert.doesNotMatch(hints ?? "", /AFTER-HOURS HANDOFF/i)
  })
})
