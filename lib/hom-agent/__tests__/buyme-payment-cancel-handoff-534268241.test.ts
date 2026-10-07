import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { isOrderCancellationSummaryLabel } from "@/lib/agents/service-intake"

/** 534268241 — BUYME + credit split charged wrong; bot wrote מעביר but action=reply on first turn. */
describe("buyme payment cancel handoff 534268241", () => {
  const openingBody =
    "הייי תקשיבו בלאגן ניסיתי לעשות קנייה עכשיו עם הbuyme ועאת היתרה עם האשראי זה לקח לי הכל מהאשראי אפשר לבטל לי אותה ואני אנסה שוב?"

  it("detects cancel intent from אפשר לבטל לי אותה", () => {
    assert.ok(isOrderCancellationSummaryLabel("אפשר לבטל לי אותה ואני אנסה שוב"))
    assert.ok(isOrderCancellationSummaryLabel(openingBody))
  })

  it("hints checkout payment split cancel + human_service on opening turn", () => {
    const hints = buildConversationHints({
      history: [],
      body: openingBody,
      whatsappPhone: "0501238875",
    })
    assert.notEqual(hints, null)
    assert.match(hints!, /CHECKOUT PAYMENT SPLIT CANCEL \(534268241\)/)
    assert.match(hints!, /action human_service/)
    assert.match(hints!, /Never action reply when you write מעביר/)
  })
})
