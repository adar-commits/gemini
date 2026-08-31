import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildCarpetRentalPolicyReply,
  isCarpetRentalQuestion,
} from "@/lib/agents/policy-subjects"

describe("carpet rental policy", () => {
  it("detects rental / borrow / try-before-buy questions", () => {
    assert.equal(isCarpetRentalQuestion("אפשר להשאיל שטיח לנסות?"), true)
    assert.equal(isCarpetRentalQuestion("יש אפשרות להשאלת שטיחים?"), true)
    assert.equal(isCarpetRentalQuestion("מתלבטים בין שני דגמים"), true)
    assert.equal(isCarpetRentalQuestion("מה מדיניות החזרה?"), false)
  })

  it("answers from KB policy without claiming no information", () => {
    const reply = buildCarpetRentalPolicyReply()
    assert.match(reply, /לא שירות קבועה/)
    assert.match(reply, /שני עיצובים|שני דגמים/i)
    assert.match(reply, /יועץ מכירות/)
    assert.doesNotMatch(reply, /אין לי מידע/)
  })
})
