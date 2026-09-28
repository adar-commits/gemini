import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { resolveOrderShippingReply } from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

/** 532138355 — bot offered two SO orders; customer picked "האחרונה"; bot re-asked the phone and found a different order. */
describe("offered order choice binds to the chosen id 532138355", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "אשמח להבין סטטוס של ההזמנה. מתי אמורה להגיע" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* היי שחר! בשיחה מופיעות שתי הזמנות. לבדוק את SO26022165 או את SO26023085?",
    },
  ]

  it("hints to look up the picked order with lookupHint, not the phone", () => {
    const hints = buildConversationHints({
      body: "האחרונה",
      history,
      whatsappPhone: "+972545802021",
    })
    assert.match(hints ?? "", /ORDER CHOICE BINDING \(532138355\)/)
    assert.match(hints ?? "", /SO26022165 \/ SO26023085/)
    assert.match(hints ?? "", /lookupHint = the chosen order id/)
  })

  it("no binding hint when the last question names a single order", () => {
    const hints = buildConversationHints({
      body: "כן",
      history: [
        { role: "user", content: "מתי ההזמנה מגיעה?" },
        {
          role: "assistant",
          content: "*הום בוט :)* אתם שואלים על ההזמנה SO26022813?",
        },
      ],
    })
    assert.doesNotMatch(hints ?? "", /ORDER CHOICE BINDING/)
  })

  it("lookup with the chosen SO as lookupHint does not fall back to the phone question", async () => {
    const reply = await resolveOrderShippingReply({
      body: "האחרונה",
      history,
      phone: "+972545802021",
      lookupHint: "SO26023085",
    })
    assert.doesNotMatch(reply, /רשומה על המספר ממנו אני מתכתב/)
  })

  it("without the chosen id the tool still asks the phone (control)", async () => {
    const reply = await resolveOrderShippingReply({
      body: "האחרונה",
      history,
      phone: "+972545802021",
    })
    assert.match(reply, /רשומה על המספר ממנו אני מתכתב/)
  })
})
