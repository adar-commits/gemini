import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildOrderConfirmationPrompt,
  buildOrderPickExhaustedHandoffPrompt,
  buildOrderStatusReply,
  buildPhoneLookupConfirmPrompt,
  isIdentifiedOrderRejection,
  mentionsAnotherOrderSamePhone,
  resolveOrderShippingReply,
} from "@/lib/agents/order-lookup"
import type { OrderShipmentStatus } from "@/lib/agents/order-lookup"
import {
  clearOrdersLookupCache,
  rememberConversationOrdersLookup,
} from "@/lib/agents/order-lookup-cache"
import {
  bindPriorityApiLogContext,
  PRIORITY_API_PREMESSAGE,
  resetPriorityApiTurnState,
} from "@/lib/agents/priority-webhook"
import type { HistoryMessage } from "@/lib/agents/types"

const order75503: OrderShipmentStatus = {
  orderNumber: "75503",
  branchLabel: "אתר אינטרנט",
  statusCode: "1",
  statusLabel: "בטיפול",
  statusDescription: "ההזמנה התקבלה.",
  branchCode: null,
  totalPrice: 299,
  raw: { ORDNAME: "SO26075503", REFERENCE: "75503", BRANCHNAME: "3000", CURDATE: "2026-08-21T00:00:00Z" },
}

const order76001: OrderShipmentStatus = {
  orderNumber: "76001",
  branchLabel: "אתר אינטרנט",
  statusCode: "2",
  statusLabel: "משלוח נוצר",
  statusDescription: "ההזמנה נארזה.",
  branchCode: null,
  totalPrice: 890,
  raw: { ORDNAME: "SO26076001", REFERENCE: "76001", BRANCHNAME: "3000", CURDATE: "2026-09-01T00:00:00Z" },
}

const order76100: OrderShipmentStatus = {
  orderNumber: "76100",
  branchLabel: "סניף ראשון לציון",
  statusCode: "2",
  statusLabel: "משלוח נוצר",
  statusDescription: "ההזמנה נארזה.",
  branchCode: null,
  totalPrice: 1200,
  raw: { ORDNAME: "SO26076100", CURDATE: "2026-09-05T00:00:00Z" },
}

describe("multi-order pick after rejection", () => {
  it("detects another-order hints without treating them as alternate phone", () => {
    assert.equal(mentionsAnotherOrderSamePhone("יש עוד אחת"), true)
    assert.equal(mentionsAnotherOrderSamePhone("יש מספר הזמנה נוסף"), true)
    assert.equal(mentionsAnotherOrderSamePhone("לא"), false)
    assert.equal(isIdentifiedOrderRejection("אז זה לא זה"), true)
    assert.equal(isIdentifiedOrderRejection("גם זה לא"), true)
    assert.equal(isIdentifiedOrderRejection("זו לא ההזמנה"), true)
    assert.equal(isIdentifiedOrderRejection("אם זה לא ימצא חן בעיני"), false)
    assert.equal(isIdentifiedOrderRejection("לא הבנתי"), false)
  })

  it("shows the next order when customer rejects the first card", async () => {
    clearOrdersLookupCache()
    resetPriorityApiTurnState()
    bindPriorityApiLogContext({
      conversationId: "conv-lorin-multi",
      whatsappPhone: "+972528632111",
    })
    rememberConversationOrdersLookup("conv-lorin-multi", "0528632111", [
      order75503,
      order76001,
    ])

    const whatsappPhone = "+972528632111"
    const history: HistoryMessage[] = [
      { role: "assistant", content: buildPhoneLookupConfirmPrompt(whatsappPhone) },
      { role: "assistant", content: PRIORITY_API_PREMESSAGE },
      { role: "user", content: "כן" },
      { role: "assistant", content: buildOrderConfirmationPrompt(order75503) },
    ]

    const reply = await resolveOrderShippingReply({
      body: "לא",
      phone: whatsappPhone,
      history,
    })

    assert.match(reply, /76001/)
    assert.doesNotMatch(reply, /75503/)
    assert.doesNotMatch(reply, /מה מספר הטלפון/)
  })

  it("advances through three candidates then offers human handoff", async () => {
    clearOrdersLookupCache()
    resetPriorityApiTurnState()
    bindPriorityApiLogContext({
      conversationId: "conv-lorin-exhaust",
      whatsappPhone: "+972528632111",
    })
    rememberConversationOrdersLookup("conv-lorin-exhaust", "0528632111", [
      order75503,
      order76001,
      order76100,
      {
        ...order76100,
        orderNumber: "76200",
        raw: { ...order76100.raw, ORDNAME: "SO26076200", REFERENCE: "76200" },
      },
    ])

    const whatsappPhone = "+972528632111"
    const history: HistoryMessage[] = [
      { role: "assistant", content: buildOrderConfirmationPrompt(order75503) },
      { role: "user", content: "לא" },
      { role: "assistant", content: buildOrderConfirmationPrompt(order76001) },
      { role: "user", content: "לא" },
      { role: "assistant", content: buildOrderConfirmationPrompt(order76100) },
    ]

    const reply = await resolveOrderShippingReply({
      body: "לא",
      phone: whatsappPhone,
      history,
    })

    assert.equal(reply.trim(), buildOrderPickExhaustedHandoffPrompt().trim())
  })

  it("recognizes same-phone reply during alternate-phone ask and shows next order", async () => {
    clearOrdersLookupCache()
    resetPriorityApiTurnState()
    bindPriorityApiLogContext({
      conversationId: "conv-lorin-same-phone",
      whatsappPhone: "+972528632111",
    })
    rememberConversationOrdersLookup("conv-lorin-same-phone", "0528632111", [
      order75503,
      order76001,
    ])

    const { buildAlternatePhoneRequestPrompt } = await import("@/lib/agents/order-lookup")
    const whatsappPhone = "+972528632111"
    const history: HistoryMessage[] = [
      { role: "assistant", content: buildOrderConfirmationPrompt(order75503) },
      { role: "user", content: "לא" },
      { role: "assistant", content: buildAlternatePhoneRequestPrompt() },
    ]

    const reply = await resolveOrderShippingReply({
      body: "אותו מספר",
      phone: whatsappPhone,
      history,
    })

    assert.match(reply, /76001/)
    assert.doesNotMatch(reply, /לא זיהיתי מספר/)
  })

  it("after status, 'אז זה לא זה' offers the next unused API order", async () => {
    clearOrdersLookupCache()
    resetPriorityApiTurnState()
    bindPriorityApiLogContext({
      conversationId: "conv-post-status-reject",
      whatsappPhone: "+972523960124",
    })
    rememberConversationOrdersLookup("conv-post-status-reject", "0523960124", [
      order75503,
      order76001,
    ])

    const whatsappPhone = "+972523960124"
    const history: HistoryMessage[] = [
      { role: "assistant", content: buildPhoneLookupConfirmPrompt(whatsappPhone) },
      { role: "user", content: "כן" },
      { role: "assistant", content: buildOrderConfirmationPrompt(order75503) },
      { role: "user", content: "כן" },
      { role: "assistant", content: buildOrderStatusReply(order75503) },
    ]

    const reply = await resolveOrderShippingReply({
      body: "אז זה לא זה",
      phone: whatsappPhone,
      history,
    })

    assert.match(reply, /76001/)
    assert.doesNotMatch(reply, /75503/)
    assert.doesNotMatch(reply, /מה מספר ההזמנה/)
    assert.doesNotMatch(reply, /נציג שירות/)
  })

  it("after the last unused order is also rejected, offers a human", async () => {
    clearOrdersLookupCache()
    resetPriorityApiTurnState()
    bindPriorityApiLogContext({
      conversationId: "conv-post-status-exhaust",
      whatsappPhone: "+972523960124",
    })
    rememberConversationOrdersLookup("conv-post-status-exhaust", "0523960124", [
      order75503,
      order76001,
    ])

    const whatsappPhone = "+972523960124"
    const history: HistoryMessage[] = [
      { role: "assistant", content: buildOrderConfirmationPrompt(order75503) },
      { role: "user", content: "כן" },
      { role: "assistant", content: buildOrderStatusReply(order75503) },
      { role: "user", content: "אז זה לא זה" },
      { role: "assistant", content: buildOrderConfirmationPrompt(order76001) },
    ]

    const reply = await resolveOrderShippingReply({
      body: "גם זה לא",
      phone: whatsappPhone,
      history,
    })

    assert.equal(reply.trim(), buildOrderPickExhaustedHandoffPrompt().trim())
  })

  it("treats 'יש עוד אחת' as rejection and shows next order", async () => {
    clearOrdersLookupCache()
    resetPriorityApiTurnState()
    bindPriorityApiLogContext({
      conversationId: "conv-lorin-another-one",
      whatsappPhone: "+972528632111",
    })
    rememberConversationOrdersLookup("conv-lorin-another-one", "0528632111", [
      order75503,
      order76001,
    ])

    const whatsappPhone = "+972528632111"
    const history: HistoryMessage[] = [
      { role: "assistant", content: buildOrderConfirmationPrompt(order75503) },
    ]

    const reply = await resolveOrderShippingReply({
      body: "יש עוד אחת",
      phone: whatsappPhone,
      history,
    })

    assert.match(reply, /76001/)
    assert.doesNotMatch(reply, /מה מספר הטלפון/)
  })
})
