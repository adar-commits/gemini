import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isShippingAddressUpdateThread } from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runStructuredOrderLookupPreTurn } from "@/lib/hom-agent/pre-turn"
import { executeLookupOrderStatus } from "@/lib/hom-agent/tools/order-status"
import type { HistoryMessage } from "@/lib/agents/types"

/** 532692073 — change delivery address is KB, not a shipment-status card. */
describe("shipping address update 532692073", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "היי, אני צריכה לשנות את הכתובת למשלוח" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nמבין שתרצו לשנות את כתובת המשלוח בהזמנה.\nאם ההזמנה עדיין לא נמסרה לחברת השליחויות אפשר לעדכן את הכתובת.",
    },
    { role: "user", content: "כ״ט בנובמבר 7, דירה 4\nהרצליה" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nתודה, רשמתי את הכתובת החדשה — כ״ט בנובמבר 7, דירה 4, הרצליה.\nיש לכם מספר הזמנה?",
    },
  ]

  it("recognizes the thread from the bot's address-change replies", () => {
    assert.equal(isShippingAddressUpdateThread(history), true)
    assert.equal(isShippingAddressUpdateThread([]), false)
  })

  it("hints KB policy and forbids a status lookup", () => {
    const hints = buildConversationHints({
      body: "#77110",
      history,
    })
    assert.match(hints ?? "", /SHIPPING ADDRESS UPDATE/)
    assert.match(hints ?? "", /not always possible/)
    assert.match(hints ?? "", /Do NOT call lookup_order_status/)
  })

  it("refuses lookup_order_status so the order number cannot become a status card", async () => {
    const result = await executeLookupOrderStatus({
      body: "#77110",
      history,
      phone: "0500000000",
    })
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.match(result.error, /SHIPPING ADDRESS UPDATE/)
    assert.match(result.error, /077-9725055/)
  })

  it("skips structured order lookup so the LLM can answer from KB", async () => {
    const result = await runStructuredOrderLookupPreTurn({
      turn: { text: "#77110", media: [] },
      history,
      phone: "0500000000",
    })
    assert.equal(result.kind, "skip")
  })
})
