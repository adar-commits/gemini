import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  bindPriorityApiLogContext,
  resetPriorityApiTurnState,
} from "@/lib/agents/priority-webhook"
import type { HistoryMessage } from "@/lib/agents/types"
import {
  authorizedLookupPhoneFromHistory,
  buildOrderConfirmationPrompt,
  extractOrderNumberFromConfirmationPrompt,
  ltrIsolateOrderNumber,
  pendingOrderNumberFromHistory,
  resolveLookupPhoneFromHistory,
} from "@/lib/agents/order-lookup"
import {
  clearOrdersLookupCache,
  recallConversationLookupPhone,
  recallConversationOrdersRelaxed,
  rememberConversationOrdersLookup,
} from "@/lib/agents/order-lookup-cache"
import type { OrderShipmentStatus } from "@/lib/agents/order-lookup"

const sampleOrder: OrderShipmentStatus = {
  orderNumber: "SO26021240",
  branchLabel: "אתר אינטרנט",
  statusCode: "1",
  statusLabel: "בטיפול",
  statusDescription: "ההזמנה נארזה ומוכנה לאיסוף.",
  branchCode: null,
  totalPrice: 534.5,
  raw: { ORDNAME: "SO26021240" },
}

describe("order confirm after alternate phone", () => {
  it("extracts pending order from confirmation even when wait message is newer", () => {
    const confirmation = buildOrderConfirmationPrompt(sampleOrder)
    const history: HistoryMessage[] = [
      { role: "assistant", content: confirmation, agent: "master" },
      { role: "assistant", content: "אני על זה, כמה רגעים בבקשה..", agent: "master" },
    ]
    assert.equal(pendingOrderNumberFromHistory(history), "SO26021240")
  })

  it("authorizes alternate phone from LLM-style phone question", () => {
    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nהאם ההזמנה רשומה על המספר ממנו אתם מדברים כרגע (052-3925554) או שתרצו לציין מספר אחר?",
        agent: "master",
      },
      { role: "user", content: "0544760645", agent: null },
      {
        role: "assistant",
        content: buildOrderConfirmationPrompt(sampleOrder),
        agent: "master",
      },
    ]
    assert.equal(
      authorizedLookupPhoneFromHistory(history, "+972523925554"),
      "0544760645"
    )
  })

  it("falls back to typed phone before confirmation when phone ask was non-standard", () => {
    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content: "*הום בוט :)*\nכדי לאתר — שלחו מספר טלפון אחר אם צריך.",
        agent: "master",
      },
      { role: "user", content: "0544760645", agent: null },
      {
        role: "assistant",
        content: buildOrderConfirmationPrompt(sampleOrder),
        agent: "master",
      },
    ]
    assert.equal(
      authorizedLookupPhoneFromHistory(history, "+972523925554"),
      "0544760645"
    )
  })

  it("uses conversation cache phone on confirm when channel differs", () => {
    clearOrdersLookupCache()
    rememberConversationOrdersLookup("conv-confirm", "0544760645", [sampleOrder])
    assert.equal(recallConversationLookupPhone("conv-confirm"), "0544760645")
    assert.equal(recallConversationOrdersRelaxed("conv-confirm")?.[0]?.orderNumber, "SO26021240")

    resetPriorityApiTurnState()
    bindPriorityApiLogContext({
      conversationId: "conv-confirm",
      whatsappPhone: "+972523925554",
    })

    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content: buildOrderConfirmationPrompt(sampleOrder),
        agent: "master",
      },
    ]

    assert.equal(
      extractOrderNumberFromConfirmationPrompt(buildOrderConfirmationPrompt(sampleOrder)),
      "SO26021240"
    )
    assert.equal(pendingOrderNumberFromHistory(history), "SO26021240")
    assert.equal(
      resolveLookupPhoneFromHistory(history, "+972523925554", "כן"),
      "0544760645"
    )
  })

  it("wraps order numbers for RTL display", () => {
    assert.equal(ltrIsolateOrderNumber("SO26021240"), "\u2066SO26021240\u2069")
    assert.match(buildOrderConfirmationPrompt(sampleOrder), /\u2066SO26021240\u2069/)
  })
})
