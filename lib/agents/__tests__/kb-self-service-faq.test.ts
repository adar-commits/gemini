import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  coerceKbSelfServiceFaqAction,
  customerExplicitlyRequestsHuman,
  isKbSelfServiceFaqThisTurn,
} from "@/lib/agents/kb-self-service-faq"
import type { HistoryMessage } from "@/lib/agents/types"

describe("kb self-service FAQ guard", () => {
  it("detects return shipping fee and rug cleaning as KB FAQ", () => {
    assert.equal(
      isKbSelfServiceFaqThisTurn(
        "אני אשמח לדעת כמה יעלה לי אם קודם אקבל אותו הביתה ואז אתחרט. כמה דמי משלוח"
      ),
      true
    )
    assert.equal(
      isKbSelfServiceFaqThisTurn("מבקשת לבדוק אם אתם מנקים שטיחים שאגי כולל נטרול ריח"),
      true
    )
  })

  it("does not treat explicit rep request as KB FAQ", () => {
    assert.equal(customerExplicitlyRequestsHuman("כן להעביר לנציג"), true)
    assert.equal(
      isKbSelfServiceFaqThisTurn("כן להעביר לנציג שירות"),
      false
    )
  })

  it("downgrades mistaken human_service on FAQ turns", () => {
    const body =
      "אני אשמח לדעת כמה יעלה לי אם קודם אקבל אותו הביתה ואז אתחרט. כמה דמי משלוח"
    const coerced = coerceKbSelfServiceFaqAction(
      { action: "human_service", reply: "" },
      body,
      []
    )
    assert.equal(coerced.action, "reply")
  })

  it("keeps human_service when customer explicitly asks for rep", () => {
    const coerced = coerceKbSelfServiceFaqAction(
      { action: "human_service", reply: "מעביר" },
      "כן להעביר לנציג שירות",
      []
    )
    assert.equal(coerced.action, "human_service")
  })
})
