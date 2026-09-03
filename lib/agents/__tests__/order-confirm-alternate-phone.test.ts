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

describe("alternate phone during order rejection", () => {
  const wrongOrder: OrderShipmentStatus = {
    orderNumber: "SO26016425",
    branchLabel: "סגולה פ\"ת",
    statusCode: "1",
    statusLabel: "בטיפול",
    statusDescription: "ההזמנה נארזה.",
    branchCode: null,
    totalPrice: 770,
    raw: { ORDNAME: "SO26016425", CURDATE: "2026-07-19T00:00:00Z" },
  }

  const alternateOrder: OrderShipmentStatus = {
    orderNumber: "SO26029999",
    branchLabel: "אתר אינטרנט",
    statusCode: "2",
    statusLabel: "משלוח נוצר",
    statusDescription: "ההזמנה נארזה ומוכנה לאיסוף.",
    branchCode: null,
    totalPrice: 1200,
    raw: { ORDNAME: "SO26029999" },
  }

  it("looks up with typed alternate phone instead of repeating rejected order", async () => {
    clearOrdersLookupCache()
    resetPriorityApiTurnState()
    bindPriorityApiLogContext({
      conversationId: "conv-noa-alt-phone",
      whatsappPhone: "+972501234567",
    })
    rememberConversationOrdersLookup("conv-noa-alt-phone", "0501234567", [wrongOrder])
    rememberConversationOrdersLookup("conv-noa-alt-phone", "0528386981", [alternateOrder])

    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content: buildOrderConfirmationPrompt(wrongOrder),
      },
    ]

    const { resolveOrderShippingReply } = await import("@/lib/agents/order-lookup")
    const reply = await resolveOrderShippingReply({
      body: "0528386981",
      phone: "+972501234567",
      history,
    })

    assert.match(reply, /SO26029999/)
    assert.doesNotMatch(reply, /SO26016425/)
    assert.doesNotMatch(reply, /לא הבנתי — כתבו כן/)
  })

  it("asks for alternate phone when customer rejects the only order on file", async () => {
    clearOrdersLookupCache()
    resetPriorityApiTurnState()
    bindPriorityApiLogContext({
      conversationId: "conv-noa-reject",
      whatsappPhone: "+972501234567",
    })
    rememberConversationOrdersLookup("conv-noa-reject", "0501234567", [wrongOrder])

    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content: buildOrderConfirmationPrompt(wrongOrder),
      },
    ]

    const { resolveOrderShippingReply, buildAlternatePhoneRequestPrompt } =
      await import("@/lib/agents/order-lookup")
    const reply = await resolveOrderShippingReply({
      body: "לא... זאת לא ההזמנה שלי",
      phone: "+972501234567",
      history,
    })

    assert.equal(reply.trim(), buildAlternatePhoneRequestPrompt().trim())
  })

  it("requires phone confirm before lookup when order card exists without authorization", async () => {
    clearOrdersLookupCache()
    resetPriorityApiTurnState()

    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content: buildOrderConfirmationPrompt(wrongOrder),
      },
    ]

    const { resolveOrderShippingReply, buildPhoneLookupConfirmPrompt } =
      await import("@/lib/agents/order-lookup")
    const reply = await resolveOrderShippingReply({
      body: "כן",
      phone: "+972501234567",
      history,
    })

    assert.match(reply, /קודם אמצא את ההזמנה/)
    assert.doesNotMatch(reply, /בדקתי,/)
  })
})
