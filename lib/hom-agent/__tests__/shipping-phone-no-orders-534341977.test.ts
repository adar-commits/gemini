import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildNoOrdersFoundReply,
  isNoOrdersFoundReplyPending,
  resolveOrderShippingReply,
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

const WHATSAPP = "+972546325180"
const TYPED_PHONE = "0546325180"

function history534341977(): HistoryMessage[] {
  return [
    { role: "user", content: "היי" },
    {
      role: "user",
      content:
        "עשינו הזמנה לפני יותר משבוע אשמח לדעת אם זה כבר יצא למשלוח/ כמה זמן זה יקח ? תודה.",
    },
    {
      role: "assistant",
      content:
        '*הום בוט :)* היי דניאלה, בוקר טוב! כדי לבדוק אם ההזמנה כבר יצאה למשלוח, אשמח למספר ההזמנה (למשל #76884). אם אין לך אותו, אפשר לכתוב "לפי הטלפון" ואאתר לפי המספר שממנו את כותבת.',
    },
    {
      role: "assistant",
      content: "*הום בוט :)* אני על זה, כמה רגעים בבקשה 🙏",
    },
  ]
}

/** 534341977 — shipping ETA + typed phone with no orders must ask order #, not handoff. */
describe("shipping phone no orders 534341977", () => {
  it("buildNoOrdersFoundReply does not double-wrap phone parentheses", () => {
    const reply = buildNoOrdersFoundReply("0546325180")
    assert.match(reply, /\(054-6325180\)/)
    assert.doesNotMatch(reply, /\(\(/)
  })

  it("resolveOrderShippingReply asks for order number instead of rep handoff", async () => {
    resetPriorityApiTurnState()
    clearOrdersLookupCache()
    bindPriorityApiLogContext({
      conversationId: "534341977",
      whatsappPhone: WHATSAPP,
    })
    rememberConversationOrdersLookup("534341977", TYPED_PHONE, [])

    const reply = await resolveOrderShippingReply({
      body: TYPED_PHONE,
      phone: WHATSAPP,
      history: history534341977(),
    })

    assert.match(reply, /לא מצאתי הזמנות/)
    assert.match(reply, /מספר ההזמנה/)
    assert.doesNotMatch(reply, /האם להעביר/)
    assert.doesNotMatch(reply, /נציג/)
    assert.doesNotMatch(reply, /\(\(/)

    const next: HistoryMessage[] = [
      ...history534341977(),
      { role: "assistant", content: reply },
    ]
    assert.equal(isNoOrdersFoundReplyPending(next), false)
  })
})
