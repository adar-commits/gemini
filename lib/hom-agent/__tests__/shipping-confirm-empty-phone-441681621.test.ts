import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildNoOrdersFoundReply,
  buildOrderConfirmationPrompt,
  isOrderConfirmationPending,
  isPureOrderConfirmation,
  mapPriorityOrderRow,
  resolveLookupPhoneFromHistory,
  resolveOrderShippingReply,
  type OrderShipmentStatus,
} from "@/lib/agents/order-lookup"
import {
  clearOrdersLookupCache,
  rememberConversationOrdersLookup,
  rememberOrdersLookup,
} from "@/lib/agents/order-lookup-cache"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runStructuredOrderLookupPreTurn } from "@/lib/hom-agent/pre-turn"
import {
  bindPriorityApiLogContext,
  resetPriorityApiTurnState,
} from "@/lib/agents/priority-webhook"
import type { HistoryMessage } from "@/lib/agents/types"

const WHATSAPP = "+972501234567"
const CHANNEL_PHONE = "0501234567"
const WRONG_LOOKUP_PHONE = "0779725055"

const order641: OrderShipmentStatus = mapPriorityOrderRow({
  ORDNAME: "SO26022640",
  REFERENCE: "22640",
  BRANCHNAME: "2000",
  ORDISTATUSDES: "ההזמנה הועברה לחברת השליחויות",
  CURDATE: "2026-09-17T00:00:00Z",
})

function history441681621(): HistoryMessage[] {
  return [
    {
      role: "user",
      content: "פשוט לפני שבוע כבר הודעתם שהמשלוח אצל השליח, והוא לא הגיע",
    },
    {
      role: "assistant",
      content: buildOrderConfirmationPrompt(order641),
    },
  ]
}

/** Replay 441681621 — כן after order card must lookup status, not phone-miss handoff. */
describe("shipping confirm after empty phone lookup 441681621", () => {
  it("detects order confirm pending on the card", () => {
    assert.equal(isOrderConfirmationPending(history441681621()), true)
    assert.equal(isPureOrderConfirmation("כן"), true)
  })

  it("resolveLookupPhone prefers channel on כן after order card, not stale 077", () => {
    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content: buildNoOrdersFoundReply(WRONG_LOOKUP_PHONE),
      },
      { role: "user", content: CHANNEL_PHONE },
      {
        role: "assistant",
        content: buildOrderConfirmationPrompt(order641),
      },
    ]
    assert.equal(
      resolveLookupPhoneFromHistory(history, WHATSAPP, "כן"),
      CHANNEL_PHONE
    )
  })

  it("hints bind lookup_order_status on confirm — not phone-miss handoff", () => {
    const hints =
      buildConversationHints({
        body: "כן",
        history: history441681621(),
        whatsappPhone: WHATSAPP,
      }) ?? ""
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /441681621/)
    assert.match(hints, /SHIPPING ORDER CONFIRM YES/)
  })

  it("structured confirm uses channel orders when lookup phone cache is empty", async () => {
    resetPriorityApiTurnState()
    clearOrdersLookupCache()
    bindPriorityApiLogContext({
      conversationId: "441681621",
      whatsappPhone: WHATSAPP,
    })
    rememberOrdersLookup(WRONG_LOOKUP_PHONE, [])
    rememberConversationOrdersLookup("441681621", CHANNEL_PHONE, [order641])

    const result = await runStructuredOrderLookupPreTurn({
      turn: { text: "כן", media: [] },
      history: history441681621(),
      phone: WHATSAPP,
    })

    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.doesNotMatch(result.reply, /לא מצאתי הזמנות פעילות לפי הטלפון/)
    assert.match(result.reply, /בדקתי|22640|SO26022640/i)
  })

  it("resolveOrderShippingReply recovers from thread cache on empty phone list", async () => {
    resetPriorityApiTurnState()
    clearOrdersLookupCache()
    bindPriorityApiLogContext({
      conversationId: "441681621-recover",
      whatsappPhone: WHATSAPP,
    })
    rememberConversationOrdersLookup("441681621-recover", WRONG_LOOKUP_PHONE, [])
    rememberOrdersLookup(CHANNEL_PHONE, [order641])

    const reply = await resolveOrderShippingReply({
      body: "כן",
      phone: WHATSAPP,
      history: history441681621(),
    })

    assert.doesNotMatch(reply, /לא מצאתי הזמנות פעילות לפי הטלפון/)
    assert.match(reply, /בדקתי|22640|SO26022640/i)
  })
})
