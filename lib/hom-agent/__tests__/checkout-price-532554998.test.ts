import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isKbSelfServiceFaqThisTurn } from "@/lib/agents/kb-self-service-faq"
import {
  isCheckoutPriceDiscrepancyQuestion,
  isReturnPolicyQuestion,
} from "@/lib/agents/inquiry-intent"
import {
  isReturnExchangePolicyFaqQuestion,
  resolveReturnExchangePolicyReply,
} from "@/lib/agents/policy-subjects"
import { runStructuredKbSelfServiceFaqPreTurn } from "@/lib/hom-agent/pre-turn"

const CUSTOMER_MESSAGE =
  "היי אשמח לפרטים נוספים לגבי שטיח טורי בז' TORY. \nאיך יתכן שהמחיר המפורסם הוא 2337 ש\"ח, אבל כשבאתי לשלם המחיר עלה ל- 3895 ש\"ח? \nתודה על המענה."

/** Replay 532554998 — checkout price jump must not trigger return/exchange FAQ pre-turn. */
describe("checkout price discrepancy (532554998)", () => {
  it("detects cart-to-checkout price complaint", () => {
    assert.equal(isCheckoutPriceDiscrepancyQuestion(CUSTOMER_MESSAGE), true)
  })

  it("does not classify איך יתכן + price as return policy", () => {
    assert.equal(isReturnPolicyQuestion(CUSTOMER_MESSAGE), false)
    assert.equal(isReturnExchangePolicyFaqQuestion(CUSTOMER_MESSAGE), false)
    assert.equal(isKbSelfServiceFaqThisTurn(CUSTOMER_MESSAGE, []), false)
  })

  it("structured KB pre-turn skips so LLM can handle sales + pricing", () => {
    const result = runStructuredKbSelfServiceFaqPreTurn({
      turn: { text: CUSTOMER_MESSAGE, media: [] },
      history: [],
    })
    assert.equal(result.kind, "skip")
  })

  it("still treats real return policy questions as FAQ", () => {
    const message = "מה מדיניות ההחזרה?"
    assert.equal(isReturnPolicyQuestion(message), true)
    assert.equal(isCheckoutPriceDiscrepancyQuestion(message), false)
    assert.match(resolveReturnExchangePolicyReply(message), /פורטל/)
  })

  it("does not use combined policy wall for price message", () => {
    assert.equal(resolveReturnExchangePolicyReply(CUSTOMER_MESSAGE), null)
  })
})
