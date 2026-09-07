import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  bindPriorityApiLogContext,
  resetPriorityApiTurnState,
} from "@/lib/agents/priority-webhook"
import type { HistoryMessage } from "@/lib/agents/types"
import {
  authorizedLookupPhoneFromHistory,
  buildInitialPhoneLookupPrompt,
  buildInvalidChannelPhonePrompt,
  buildOrderConfirmationPrompt,
  buildPhoneLookupConfirmPrompt,
  channelPhone,
  isAlternatePhoneRequestPending,
  isOrderLookupPhoneReplyPending,
  resolveOrderShippingReply,
} from "@/lib/agents/order-lookup"
import {
  clearOrdersLookupCache,
  rememberConversationOrdersLookup,
} from "@/lib/agents/order-lookup-cache"
import type { OrderShipmentStatus } from "@/lib/agents/order-lookup"

const invalidChannelPhone = "04850019"
const validLookupPhone = "0547653293"

const sampleOrder: OrderShipmentStatus = {
  orderNumber: "SO26019362",
  branchLabel: "אתר אינטרנט",
  statusCode: "2",
  statusLabel: "משלוח נוצר",
  statusDescription: "ההזמנה נארזה ומוכנה לאיסוף.",
  branchCode: null,
  totalPrice: 499,
  raw: { ORDNAME: "SO26019362" },
}

describe("invalid channel phone (Landbot id, not Israeli mobile)", () => {
  it("does not treat 04850019 as channel lookup phone", () => {
    assert.equal(channelPhone(invalidChannelPhone), null)
  })

  it("asks for order phone instead of channel confirm", () => {
    assert.equal(
      buildInitialPhoneLookupPrompt(invalidChannelPhone).trim(),
      buildInvalidChannelPhonePrompt().trim()
    )
    assert.doesNotMatch(
      buildInitialPhoneLookupPrompt(invalidChannelPhone),
      /האם היא רשומה על המספר/
    )
  })

  it("marks typed-phone reply pending after invalid channel prompt", () => {
    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content: buildInvalidChannelPhonePrompt(),
        agent: "master",
      },
    ]
    assert.equal(isAlternatePhoneRequestPending(history), true)
    assert.equal(isOrderLookupPhoneReplyPending(history), true)
  })

  it("looks up order when customer sends correct phone after invalid channel prompt", async () => {
    clearOrdersLookupCache()
    resetPriorityApiTurnState()
    bindPriorityApiLogContext({
      conversationId: "conv-invalid-channel",
      whatsappPhone: invalidChannelPhone,
    })
    rememberConversationOrdersLookup("conv-invalid-channel", validLookupPhone, [
      sampleOrder,
    ])

    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content: buildInvalidChannelPhonePrompt(),
        agent: "master",
      },
    ]

    const reply = await resolveOrderShippingReply({
      body: validLookupPhone,
      phone: invalidChannelPhone,
      history,
    })

    assert.match(reply, /SO26019362/)
    assert.equal(
      authorizedLookupPhoneFromHistory(history, invalidChannelPhone),
      null
    )
    assert.equal(
      authorizedLookupPhoneFromHistory(
        [
          ...history,
          { role: "user", content: validLookupPhone, agent: null },
        ],
        invalidChannelPhone
      ),
      validLookupPhone
    )
  })

  it("asks for phone again on כן when channel is invalid (not handoff)", async () => {
    clearOrdersLookupCache()
    resetPriorityApiTurnState()

    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content: buildPhoneLookupConfirmPrompt(invalidChannelPhone),
        agent: "master",
      },
    ]

    const reply = await resolveOrderShippingReply({
      body: "כן",
      phone: invalidChannelPhone,
      history,
    })

    assert.match(reply, /לא הצלחתי לזהות את מספר הטלפון/)
    assert.doesNotMatch(reply, /האם להעביר אתכם לנציג שירות אנושי/)
  })

  it("runStructuredOrderLookupPreTurn binds typed phone before LLM", async () => {
    clearOrdersLookupCache()
    resetPriorityApiTurnState()
    bindPriorityApiLogContext({
      conversationId: "conv-pre-turn-invalid",
      whatsappPhone: invalidChannelPhone,
    })
    rememberConversationOrdersLookup("conv-pre-turn-invalid", validLookupPhone, [
      sampleOrder,
    ])

    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content: buildInvalidChannelPhonePrompt(),
        agent: "master",
      },
    ]

    const { runStructuredOrderLookupPreTurn } = await import("@/lib/hom-agent/pre-turn")
    const result = await runStructuredOrderLookupPreTurn({
      turn: { text: validLookupPhone, media: [] },
      history,
      phone: invalidChannelPhone,
    })

    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.match(result.reply, /SO26019362/)
  })
})
