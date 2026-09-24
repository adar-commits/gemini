import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildOrderConfirmationPrompt,
  documentReferenceGivenInThread,
  extractShippingOrderDocumentReference,
  findOrderByDocumentReference,
  isChannelPhoneSelfReference,
  mapPriorityOrderRow,
  resolveLookupPhoneFromHistory,
  resolveOrderShippingReply,
  type OrderShipmentStatus,
} from "@/lib/agents/order-lookup"
import {
  clearOrdersLookupCache,
  rememberConversationOrdersLookup,
} from "@/lib/agents/order-lookup-cache"
import {
  bindPriorityApiLogContext,
  resetPriorityApiTurnState,
} from "@/lib/agents/priority-webhook"
import { runStructuredOrderLookupPreTurn } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

const WHATSAPP = "+972524779097"
const LOOKUP_PHONE = "0524779097"

const order533: OrderShipmentStatus = mapPriorityOrderRow({
  ORDNAME: "SO26023332",
  REFERENCE: "23332",
  BRANCHNAME: "3000",
  ORDISTATUSDES: "ההזמנה התקבלה וכעת בתהליכי אריזה במחסני החברה.",
  RC: "RC269021234",
})

function history533188424(): HistoryMessage[] {
  return [
    { role: "user", content: "מתי תגיע ההזמנה שלי?" },
    {
      role: "assistant",
      content: "אוכל לקבל את מספר ההזמנה או את מספר הטלפון?",
    },
    { role: "user", content: "לפי הטלפון" },
    { role: "assistant", content: buildOrderConfirmationPrompt(order533) },
  ]
}

describe("533188424 stale cache order confirm", () => {
  it("authorizes phone lookup preference without explicit confirm", () => {
    assert.equal(isChannelPhoneSelfReference("לפי הטלפון"), true)
    const phone = resolveLookupPhoneFromHistory(
      [
        { role: "assistant", content: "אוכל לקבל את מספר ההזמנה או את מספר הטלפון?" },
        { role: "user", content: "לפי הטלפון" },
      ],
      WHATSAPP,
      "לפי הטלפון"
    )
    assert.equal(phone, LOOKUP_PHONE)
  })

  it("resolves channel phone on כן after order card when serverless cache is cold", () => {
    resetPriorityApiTurnState()
    clearOrdersLookupCache()
    bindPriorityApiLogContext({
      conversationId: "533188424",
      whatsappPhone: WHATSAPP,
    })

    const history = history533188424()
    assert.equal(
      resolveLookupPhoneFromHistory(history, WHATSAPP, "כן"),
      LOOKUP_PHONE
    )
  })

  it("confirm כן returns status when orders are refetched, not phone re-confirm", async () => {
    resetPriorityApiTurnState()
    clearOrdersLookupCache()
    bindPriorityApiLogContext({
      conversationId: "533188424",
      whatsappPhone: WHATSAPP,
    })
    rememberConversationOrdersLookup("533188424", LOOKUP_PHONE, [order533])

    const reply = await resolveOrderShippingReply({
      body: "כן",
      phone: WHATSAPP,
      history: history533188424(),
    })

    assert.match(reply, /בדקתי/)
    assert.doesNotMatch(reply, /קודם אמצא את ההזמנה/)
    assert.doesNotMatch(reply, /האם העסקה רשומה/)
  })

  it("matches receipt RC269021234 to the order list", () => {
    const matched = findOrderByDocumentReference([order533], "RC269021234")
    assert.equal(matched?.raw.ORDNAME, "SO26023332")
  })

  it("binds זו ההזמנה to the receipt pasted earlier", () => {
    const history: HistoryMessage[] = [
      ...history533188424(),
      { role: "user", content: "RC269021234" },
    ]
    assert.equal(documentReferenceGivenInThread(history), "RC269021234")
    assert.equal(
      extractShippingOrderDocumentReference("זו ההזמנה", history),
      "RC269021234"
    )
  })

  it("structured pre-turn handles RC receipt id without LLM never-stuck", async () => {
    resetPriorityApiTurnState()
    clearOrdersLookupCache()
    bindPriorityApiLogContext({
      conversationId: "533188424-rc",
      whatsappPhone: WHATSAPP,
    })
    rememberConversationOrdersLookup("533188424-rc", LOOKUP_PHONE, [order533])

    const result = await runStructuredOrderLookupPreTurn({
      turn: { text: "RC269021234", media: [] },
      history: history533188424(),
      phone: WHATSAPP,
    })

    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.match(result.reply, /בדקתי|נדמה לי שמצאתי/)
    assert.doesNotMatch(result.reply, /לא הצלחתי להבין/)
  })
})
