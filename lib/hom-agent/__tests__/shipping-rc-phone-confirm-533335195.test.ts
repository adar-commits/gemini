import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isPhoneLookupConfirmPending,
  mapPriorityOrderRow,
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

const WHATSAPP = "+972521051057"
const LOOKUP_PHONE = "0521051057"

const order: OrderShipmentStatus = mapPriorityOrderRow({
  ORDNAME: "SO26021417",
  REFERENCE: "21417",
  BRANCHNAME: "3000",
  ORDISTATUSDES: "ההזמנה התקבלה וכעת בתהליכי אריזה במחסני החברה.",
  RC: "RC269021417",
})

function history533335195(): HistoryMessage[] {
  return [
    { role: "user", content: "שלום רציתי לדעת מתי צפי הגעה ?" },
    { role: "user", content: "RC269021417 קבלה" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* שלום איילת! מדובר בהזמנה שהקבלה שלה נשלחה אלייך כאן בצ'אט, הרשומה על מספר הטלפון הזה?",
    },
  ]
}

/** 533335195 — ETA + RC receipt, phone confirm כן must resolve RC to order, not "לא מצאתי הזמנה RC…". */
describe("shipping RC phone confirm 533335195", () => {
  it("detects the LLM receipt phone-confirm question as pending", () => {
    assert.equal(isPhoneLookupConfirmPending(history533335195()), true)
  })

  it("structured pre-turn returns shipping status after כן", async () => {
    resetPriorityApiTurnState()
    clearOrdersLookupCache()
    bindPriorityApiLogContext({
      conversationId: "533335195",
      whatsappPhone: WHATSAPP,
    })
    rememberConversationOrdersLookup("533335195", LOOKUP_PHONE, [order])

    const result = await runStructuredOrderLookupPreTurn({
      turn: { text: "כן", media: [] },
      history: history533335195(),
      phone: WHATSAPP,
    })

    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.match(result.reply, /בדקתי/)
    assert.doesNotMatch(result.reply, /לא מצאתי הזמנה\s+⁦?RC269021417/i)
  })

  it("resolveOrderShippingReply matches RC on phone after confirm", async () => {
    resetPriorityApiTurnState()
    clearOrdersLookupCache()
    bindPriorityApiLogContext({
      conversationId: "533335195-reply",
      whatsappPhone: WHATSAPP,
    })
    rememberConversationOrdersLookup("533335195-reply", LOOKUP_PHONE, [order])

    const reply = await resolveOrderShippingReply({
      body: "כן",
      phone: WHATSAPP,
      history: history533335195(),
    })

    assert.match(reply, /בדקתי/)
    assert.doesNotMatch(reply, /לא מצאתי הזמנה\s+⁦?RC269021417/i)
  })
})
