import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildOrderConfirmationClarifyPrompt,
  buildOrderConfirmationPrompt,
  isOrderConfirmationPending,
  isPureOrderConfirmation,
  resolveOrderShippingReply,
} from "@/lib/agents/order-lookup"
import { rememberConversationOrdersLookup } from "@/lib/agents/order-lookup-cache"
import {
  bindPriorityApiLogContext,
  resetPriorityApiTurnState,
} from "@/lib/agents/priority-webhook"
import { runStructuredOrderLookupPreTurn } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

describe("order confirmation natural affirmations", () => {
  const order = {
    orderNumber: "74896",
    branchLabel: "אתר אינטרנט",
    statusCode: "",
    statusLabel: "",
    statusDescription: "ההזמנה התקבלה וכעת בתהליכי אריזה במחסני החברה.",
    branchCode: null,
    totalPrice: 2791.8,
    raw: {
      ORDNAME: "SO26074896",
      REFERENCE: "74896",
      BRANCHNAME: "3000",
      CURDATE: "2026-08-11T00:00:00Z",
    },
  }

  const confirmation = buildOrderConfirmationPrompt(order)
  const history: HistoryMessage[] = [
    { role: "assistant", content: "אני על זה, כמה רגעים בבקשה.." },
    { role: "assistant", content: confirmation },
  ]

  it("treats כן זה as order confirmation", () => {
    assert.equal(isPureOrderConfirmation("כן זה"), true)
    assert.equal(isOrderConfirmationPending(history), true)
  })

  it("clarify prompt is short and does not repeat the order card", () => {
    const reply = buildOrderConfirmationClarifyPrompt()
    assert.match(reply, /לא הבנתי/)
    assert.doesNotMatch(reply, /נדמה לי שמצאתי/)
    assert.doesNotMatch(reply, /2,791/)
  })

  it("pre-turn binding delivers status on כן זה without LLM paraphrase", async () => {
    resetPriorityApiTurnState()
    bindPriorityApiLogContext({
      conversationId: "conv-noa-kenze",
      whatsappPhone: "+972501234567",
    })
    rememberConversationOrdersLookup("conv-noa-kenze", "0501234567", [order])

    const result = await runStructuredOrderLookupPreTurn({
      turn: { text: "כן זה", media: [] },
      history,
      phone: "+972501234567",
    })

    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.match(result.reply, /בדקתי,/)
    assert.doesNotMatch(result.reply, /לא הבנתי/)
    assert.doesNotMatch(result.reply, /נדמה לי שמצאתי/)
  })

  it("resolveOrderShippingReply does not repeat order card on clarify edge case", async () => {
    resetPriorityApiTurnState()
    bindPriorityApiLogContext({
      conversationId: "conv-clarify-short",
      whatsappPhone: "+972501234567",
    })
    rememberConversationOrdersLookup("conv-clarify-short", "0501234567", [order])

    const reply = await resolveOrderShippingReply({
      body: "אולי",
      phone: "+972501234567",
      history,
    })

    assert.match(reply, /לא הבנתי/)
    assert.doesNotMatch(reply, /2,791\.8/)
  })
})
