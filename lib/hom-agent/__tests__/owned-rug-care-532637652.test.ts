import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isOwnedRugCareQuestion } from "@/lib/crm/conversation-department"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"

describe("owned rug care CRM (532637652)", () => {
  const body =
    "היי, יש לי שטיח מסוג גפן כותנה. אפשר לכבס אותו? הכלבה עשתה עליו פיפי"

  it("detects wash / pee care as owned-rug FAQ", () => {
    assert.equal(isOwnedRugCareQuestion(body), true)
    assert.equal(isOwnedRugCareQuestion("מחפש שטיח לסלון שקל לניקוי"), false)
  })

  it("hints service department on the care turn", () => {
    const hints = buildConversationHints({
      body,
      history: [],
      phone: "0523583891",
    })
    assert.match(hints ?? "", /crm_department.*service/i)
  })
})
