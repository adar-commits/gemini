import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  findOrderByNumber,
  isOrderConfirmationPending,
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
import type { HistoryMessage } from "@/lib/agents/types"

const WHATSAPP = "+972526468507"
const LOOKUP_PHONE = "0526468507"

const wrongRecentOrder: OrderShipmentStatus = mapPriorityOrderRow({
  ORDNAME: "SO26077096",
  REFERENCE: "77096",
  BRANCHNAME: "3000",
  ORDISTATUSDES: "ההזמנה התקבלה וכעת בתהליכי אריזה במחסני החברה.",
  TOTPRICE: 395,
})

const defectOrder: OrderShipmentStatus = mapPriorityOrderRow({
  ORDNAME: "SO26013621",
  REFERENCE: "13621",
  BRANCHNAME: "3000",
  ORDISTATUSDES: "ההזמנה נמסרה ללקוח.",
  IN: "IN264013621",
})

function history524564187(): HistoryMessage[] {
  return [
    { role: "user", content: "שלום" },
    {
      role: "assistant",
      content: "שלום יהונתן! 😊 במה אפשר לעזור?",
    },
    {
      role: "user",
      content:
        'לפני כחודשיים רכשנו את השטיח הזה, לאחרונה שמנו לב שנוצרה לו סוג של ״בטן״ (מיד אצרף תמונות). לא עשינו איתו שום דבר לא סטנדרטי מעבר לשאיבה עם שואב סטנדרטי. אשמח לדעת מה ניתן לעשות',
    },
    {
      role: "assistant",
      content:
        '*הום בוט :)* היי יהונתן, מבין. שטיח שנוצרה לו "בטן" אחרי חודשיים זה בהחלט משהו שצריך לבדוק. אשמח לתמונה אחת ברורה שרואים בה את האזור. במקביל, יש לך מספר הזמנה? (למשל #36805) אם לא, אנסה לאתר לפי הטלפון שממנו אתה מתכתב. ברגע שיהיו לי ההזמנה והתמונה, אעביר את הפנייה לנציג שירות שיבדוק ויציע פתרון.',
    },
    {
      role: "user",
      content:
        "[תמונה][media:image:https://storage.googleapis.com/media.landbot.io/256062/customers/524325615/E60WCPXJDH28UQIJJODUBYCYSV34ZPYQ.jpg] [תמונה][media:image:https://storage.googleapis.com/media.landbot.io/256062/customers/524325615/ROJ0HIH0Q33RL2RZH6HS7WZD417OT78N.jpg]",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* תודה יהונתן, קיבלתי את התמונות. רואים שהשוליים בצד השטיח לא ישרים ונוצרה קשת לאורך הקצה. אני מבין את החשש, ונציג שירות יבדוק את זה. כדי לאתר את ההזמנה: היא רשומה על המספר שממנו אתה מתכתב (052-6468507)? אם יש לך מספר הזמנה, אפשר לשלוח גם אותו.",
    },
    { role: "user", content: "כן" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* מצאתי הזמנה שבוצעה לפני 14 ימים באתר אינטרנט, על סך 395 ש״ח. זו ההזמנה? (מס׳ הזמנה #77096)",
    },
  ]
}

/** 524564187 — defect + IN invoice after wrong order offer must resolve IN on phone, not handoff offer. */
describe("service IN invoice 524564187", () => {
  it("findOrderByNumber resolves IN264013621 from Priority raw", () => {
    const orders = [wrongRecentOrder, defectOrder]
    assert.equal(
      findOrderByNumber(orders, "IN264013621")?.orderNumber,
      "13621"
    )
  })

  it("detects order confirmation pending before the IN reply", () => {
    assert.equal(isOrderConfirmationPending(history524564187()), true)
  })

  it("resolveOrderShippingReply continues service after IN invoice, not order-not-found handoff", async () => {
    resetPriorityApiTurnState()
    clearOrdersLookupCache()
    bindPriorityApiLogContext({
      conversationId: "524564187",
      whatsappPhone: WHATSAPP,
    })
    rememberConversationOrdersLookup("524564187", LOOKUP_PHONE, [
      wrongRecentOrder,
      defectOrder,
    ])

    const reply = await resolveOrderShippingReply({
      body: "מס הזמנה IN264013621",
      phone: WHATSAPP,
      history: history524564187(),
    })

    assert.doesNotMatch(reply, /לא מצאתי הזמנה\s+⁦?IN264013621/i)
    assert.doesNotMatch(reply, /האם להעביר לנציג/i)
    assert.match(reply, /נציג|שירות|פגם|בדק/i)
  })
})
