import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isCreditCodeOnlineRedemptionRequest,
  isCreditRedemptionQuestion,
} from "@/lib/agents/inquiry-intent"
import {
  buildCreditRedemptionPolicyReply,
  sanitizeCreditRedemptionWording,
} from "@/lib/agents/policy-subjects"

describe("credit redemption policy", () => {
  it("detects how-to-redeem credit questions", () => {
    assert.equal(
      isCreditRedemptionQuestion("אשמח להמשך טיפול כיצד מממשים את הזיכוי אונליין?"),
      true
    )
    assert.equal(isCreditRedemptionQuestion("מסרתי בסניף, מתי אקבל החזר?"), false)
  })

  it("uses credit-code-only wording without voucher or self-service coupon field", () => {
    const reply = buildCreditRedemptionPolicyReply()
    assert.match(reply, /קוד זיכוי/)
    assert.match(reply, /למימוש באתר אעביר את השיחה לנציג שירות/)
    assert.doesNotMatch(reply, /שובר/)
    assert.doesNotMatch(reply, /קוד קופון/)
    assert.doesNotMatch(reply, /עמוד התשלום/)
  })

  it("sanitizes LLM drift on credit code wording", () => {
    const fixed = sanitizeCreditRedemptionWording(
      "2. קוד זיכוי / שובר — אפשר להזין בעמוד התשלום בשדה קוד קופון / זיכוי."
    )
    assert.match(fixed, /קוד זיכוי/)
    assert.doesNotMatch(fixed, /שובר/)
    assert.match(fixed, /למימוש באתר אעביר/)
  })

  it("hands off online credit-code redemption after policy", () => {
    const history = [
      {
        role: "assistant" as const,
        content: buildCreditRedemptionPolicyReply(),
      },
    ]
    assert.equal(isCreditCodeOnlineRedemptionRequest("2", history), true)
    assert.equal(isCreditCodeOnlineRedemptionRequest("קוד זיכוי באתר", history), true)
    assert.equal(isCreditCodeOnlineRedemptionRequest("קוד זיכוי באתר"), true)
  })
})
