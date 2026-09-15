import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { runStructuredKbSelfServiceFaqPreTurn } from "@/lib/hom-agent/pre-turn"

describe("structured KB FAQ pre-turn", () => {
  it("returns fee table for return shipping fee question (507969015)", async () => {
    const result = runStructuredKbSelfServiceFaqPreTurn({
      turn: {
        text: "אני אשמח לדעת כמה יעלה לי אם קודם אקבל אותו הביתה ואז אתחרט. כמה דמי משלוח",
        media: [],
      },
      history: [],
      phone: "0524247266",
    })

    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "reply")
    assert.match(result.reply, /85\s*₪/)
    assert.match(result.reply, /returns\.carpetshop/)
    assert.doesNotMatch(result.reply, /אין נציגי שירות/)
  })

  it("returns rug cleaning FAQ without handoff (532160407)", async () => {
    const result = runStructuredKbSelfServiceFaqPreTurn({
      turn: {
        text: "מבקשת לבדוק אם אתם מנקים שטיחים שאגי כולל נטרול ריח",
        media: [],
      },
      history: [],
    })

    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "reply")
    assert.match(result.reply, /אין שירות ניקוי/)
    assert.doesNotMatch(result.reply, /אין לי מידע/)
  })
})
