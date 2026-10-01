import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  findOrderByDocumentReference,
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

const WHATSAPP = "+972547495083"
const LOOKUP_PHONE = "0547495083"

const order: OrderShipmentStatus = mapPriorityOrderRow({
  ORDNAME: "SO26022223",
  REFERENCE: "22223",
  BRANCHNAME: "3000",
  ORDISTATUSDES: "ההזמנה התקבלה וכעת בתהליכי אריזה במחסני החברה.",
  RC: "RC269022223",
})

function history533851953(): HistoryMessage[] {
  return [
    { role: "user", content: "מתי ההזמנה מגיעה?" },
    { role: "user", content: "RC269022223" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* מדובר בהזמנה שהקבלה שלה נשלחה אלייך כאן בצ'אט, הרשומה על מספר הטלפון הזה?",
    },
  ]
}

/** 533851953 — phone confirm declined + RC receipt must resolve to order, not "לא מצאתי הזמנה RC…". */
describe("shipping RC phone decline 533851953", () => {
  it("detects phone-confirm pending before the decline", () => {
    assert.equal(isPhoneLookupConfirmPending(history533851953()), true)
  })

  it("matches RC269022223 to the cached order list", () => {
    assert.ok(findOrderByDocumentReference([order], "RC269022223"))
  })

  it("structured pre-turn resolves RC after לא + receipt in one turn", async () => {
    resetPriorityApiTurnState()
    clearOrdersLookupCache()
    bindPriorityApiLogContext({
      conversationId: "533851953",
      whatsappPhone: WHATSAPP,
    })
    rememberConversationOrdersLookup("533851953", LOOKUP_PHONE, [order])

    const result = await runStructuredOrderLookupPreTurn({
      turn: { text: "לא\nRC269022223", media: [] },
      history: history533851953(),
      phone: WHATSAPP,
    })

    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.match(result.reply, /בדקתי/)
    assert.doesNotMatch(result.reply, /לא מצאתי הזמנה\s+⁦?RC269022223/i)
  })

  it("resolveOrderShippingReply resolves RC after separate לא then receipt", async () => {
    resetPriorityApiTurnState()
    clearOrdersLookupCache()
    bindPriorityApiLogContext({
      conversationId: "533851953-reply",
      whatsappPhone: WHATSAPP,
    })
    rememberConversationOrdersLookup("533851953-reply", LOOKUP_PHONE, [order])

    const history: HistoryMessage[] = [
      ...history533851953(),
      { role: "user", content: "לא" },
    ]

    const reply = await resolveOrderShippingReply({
      body: "RC269022223",
      phone: WHATSAPP,
      history,
    })

    assert.match(reply, /בדקתי/)
    assert.doesNotMatch(reply, /לא מצאתי הזמנה\s+⁦?RC269022223/i)
  })
})
