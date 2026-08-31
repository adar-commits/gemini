import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isExchangePolicyQuestion,
  isReturnPolicyQuestion,
  mentionsExchangeIntent,
} from "@/lib/agents/inquiry-intent"
import { buildDissatisfactionRescueReply } from "@/lib/agents/dissatisfaction"
import {
  buildExchangePolicyReply,
  buildReturnCancellationPolicyReply,
  resolveReturnExchangePolicyReply,
  RETURNS_PORTAL_URL,
} from "@/lib/agents/policy-subjects"

describe("returns portal vs exchange routing", () => {
  it("does not send exchange-only customers to the returns portal", () => {
    const message = "היי קיבלתי שטיח ורוצה להחליף אותו במידה אחרת, מה אפשר לעשות?"
    assert.equal(mentionsExchangeIntent(message), true)
    assert.equal(isExchangePolicyQuestion(message), true)
    assert.equal(isReturnPolicyQuestion(message), false)

    const reply = resolveReturnExchangePolicyReply(message)
    assert.match(reply, /החלפה בסניפי/)
    assert.match(reply, /לא דרך פורטל/)
    assert.doesNotMatch(reply, new RegExp(RETURNS_PORTAL_URL.replace(/\./g, "\\.")))
  })

  it("still sends return-only customers to the returns portal", () => {
    const message = "היי הגיע לי השטיח ואני רוצה להחזיר מה עלי לעשות?"
    assert.equal(isReturnPolicyQuestion(message), true)

    const reply = resolveReturnExchangePolicyReply(message)
    assert.match(reply, new RegExp(RETURNS_PORTAL_URL.replace(/\./g, "\\.")))
    assert.match(reply, /פורטל/)
  })

  it("keeps portal out of exchange policy helper", () => {
    const reply = buildExchangePolicyReply()
    assert.doesNotMatch(reply, /returns\.carpetshop/)
    assert.match(reply, /לא דרך פורטל/)
  })

  it("includes portal in return cancellation policy helper", () => {
    const reply = buildReturnCancellationPolicyReply()
    assert.match(reply, new RegExp(RETURNS_PORTAL_URL.replace(/\./g, "\\.")))
  })

  it("opens dissatisfaction rescue with exchange path, not returns portal", () => {
    const reply = buildDissatisfactionRescueReply()
    assert.match(reply, /החלפה בסניפי/)
    assert.doesNotMatch(reply, /returns\.carpetshop/)
    assert.match(reply, /יועץ מכירות/)
  })

  it("mentions portal only in the return half of combined policy", () => {
    const reply = resolveReturnExchangePolicyReply("מה אפשרויות החזרה והחלפה?")
    assert.match(reply, /לא דרך פורטל/)
    assert.match(reply, new RegExp(RETURNS_PORTAL_URL.replace(/\./g, "\\.")))
    assert.match(reply, /לחלופין/)
  })
})
