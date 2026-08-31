import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import {
  classifyPostPurchaseCase,
  isMissingOrPartialDeliveryComplaint,
} from "@/lib/agents/inquiry-intent"
import {
  isOrderNumberRequestPending,
  isOrderNumberUnknownAnswer,
  isServiceOrderIdentificationPending,
  isServiceProductIdentificationAnswer,
  resolveLookupPhoneFromHistory,
} from "@/lib/agents/order-lookup"

describe("missing item order identification", () => {
  it("classifies partial delivery complaints", () => {
    assert.equal(
      classifyPostPurchaseCase("ביצעתי 2 הזמנות וקיבלתי רק אחת מהן"),
      "missing_item"
    )
    assert.ok(isMissingOrPartialDeliveryComplaint("ביצעתי 2 הזמנות וקיבלתי רק אחת מהן"))
  })

  it("detects LLM order-number ask and unknown answer", () => {
    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content: "*הום בוט :)*\nאוקיי, בוא נטפל בזה. מה מספרי ההזמנות?",
        agent: "service",
      },
    ]
    assert.ok(isOrderNumberRequestPending(history))
    assert.ok(isOrderNumberUnknownAnswer("לא יודעת"))
  })

  it("continues service identification after unknown order number", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "ביצעתי 2 הזמנות וקיבלתי רק אחת מהן", agent: null },
      {
        role: "assistant",
        content: "*הום בוט :)*\nמה מספרי ההזמנות?",
        agent: "service",
      },
      { role: "user", content: "לא יודעת", agent: null },
      {
        role: "assistant",
        content: "*הום בוט :)*\nאין בעיה. מה המוצר שעדיין לא הגיע?",
        agent: "service",
      },
    ]
    assert.ok(isServiceOrderIdentificationPending(history))
    assert.ok(
      isServiceProductIdentificationAnswer("השטיח הבהיר לסלון", history)
    )
  })

  it("does not treat bare SO order number as missing-item post-purchase in delivery scheduling", () => {
    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content: "*הום בוט :)*\nאני מבין שרוצה לתאם משלוח לשטיח. מה מספר ההזמנה?",
        agent: "service",
      },
    ]
    assert.equal(
      resolveLookupPhoneFromHistory(history, "+972523925554", "SO026019181"),
      "0523925554"
    )
  })
})
