import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isPhoneLookupConfirmPending,
  mapPriorityOrderRow,
  orderReferenceFromCustomerHistory,
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
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const WHATSAPP = "+972584446862"
const LOOKUP_PHONE = "0584446862"

const order: OrderShipmentStatus = mapPriorityOrderRow({
  ORDNAME: "SO26024269",
  REFERENCE: "24269",
  BRANCHNAME: "3000",
  ORDISTATUSDES: "ההזמנה התקבלה וכעת בתהליכי אריזה במחסני החברה.",
  ZPIT_DELSTATUSCODE: "2",
  ZPIT_DELSTATUSDES: "משלוח נוצר",
})

function history534150047(): HistoryMessage[] {
  return [
    { role: "user", content: "היי" },
    {
      role: "assistant",
      content: "*הום בוט :)* היי לינדה! 😊 במה אפשר לעזור?",
    },
    { role: "user", content: "מבקשת לקבל זמן אספקה" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* בשמחה לינדה. מדובר בהזמנה שכבר ביצעת, או בזמן אספקה כללי לפני רכישה? אם זו הזמנה קיימת, אפשר לשלוח מספר הזמנה (למשל #36805), או לכתוב לי שאאתר לפי הטלפון שממנו את כותבת.",
    },
    { role: "user", content: "SO26024269" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* קודם אמצא את ההזמנה שלכם בזריזות, האם היא רשומה על המספר ממנו אני מתכתב כרגע? (058-4446862) אם לא, אשמח לקבל אותו.",
    },
  ]
}

/** 534150047 — SO + phone confirm כן must lookup by SO, not phone-only no-orders handoff. */
describe("phone confirm SO lookup 534150047", () => {
  it("detects phone confirm pending with customer SO in thread", () => {
    const history = history534150047()
    assert.equal(isPhoneLookupConfirmPending(history), true)
    assert.equal(orderReferenceFromCustomerHistory(history), "SO26024269")
  })

  it("resolveOrderShippingReply looks up SO after phone confirm", async () => {
    resetPriorityApiTurnState()
    clearOrdersLookupCache()
    bindPriorityApiLogContext({
      conversationId: "534150047",
      whatsappPhone: WHATSAPP,
    })
    rememberConversationOrdersLookup("534150047", LOOKUP_PHONE, [order])

    const reply = await resolveOrderShippingReply({
      body: "כן",
      phone: WHATSAPP,
      history: history534150047(),
    })

    assert.match(reply, /בדקתי/)
    assert.doesNotMatch(reply, /לא מצאתי הזמנות פעילות/)
    assert.doesNotMatch(reply, /העביר/)
  })

  it("hints lookup by SO on phone confirm, not phone-only search", () => {
    const hints =
      buildConversationHints({
        body: "כן",
        history: history534150047(),
        whatsappPhone: WHATSAPP,
      }) ?? ""
    assert.match(hints, /534150047/)
    assert.match(hints, /SO26024269/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /never phone-only search/i)
    assert.match(hints, /never human_service before lookup runs/i)
  })
})
