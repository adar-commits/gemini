import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  mapPriorityOrderRow,
  resolveOrderShippingReply,
  supplementalOrderReferencesForLookup,
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

const WHATSAPP = "+972501234567"
const LOOKUP_PHONE = "0501234567"

const OPENING =
  "שלום,\n" +
  "מדובר בהזמנה מס׳ 78248, חשבונית מס׳ IN264021736.\n" +
  "קיבלתי היום את שטיח GARDA 02 בז׳ במידה 120×170. פתחתי את האריזה רק כדי לבדוק את המידה, והשטיח לא היה בשימוש. כבר ארזתי אותו מחדש באריזה המקורית.\n" +
  "אני מעוניין להגיע מחר בסביבות השעה 14:00 לסניף קריית אתא ולהחליף אותו לאותו דגם במידה 140×190, כמובן בתשלום ההפרש.\n" +
  "האם תוכלו בבקשה לאשר שניתן לבצע את ההחלפה ולבדוק שהמידה 140×190 קיימת בסניף?"

/** Order on phone — REFERENCE matches; IN omitted so invoice-only lookup fails first. */
const exchangeOrder: OrderShipmentStatus = mapPriorityOrderRow({
  ORDNAME: "SO26078248",
  REFERENCE: "78248",
  BRANCHNAME: "3000",
  ORDISTATUSDES: "ההזמנה נמסרה ללקוח.",
})

/** 531417376 — exchange opener with IN + order #78248 must fallback to REFERENCE, not handoff. */
describe("exchange invoice order fallback 531417376", () => {
  it("supplementalOrderReferencesForLookup picks order # when primary is IN", () => {
    const refs = supplementalOrderReferencesForLookup(OPENING, [], "IN264021736")
    assert.deepEqual(refs, ["78248"])
  })

  it("resolveOrderShippingReply finds order by #78248 after IN miss", async () => {
    resetPriorityApiTurnState()
    clearOrdersLookupCache()
    bindPriorityApiLogContext({
      conversationId: "531417376",
      whatsappPhone: WHATSAPP,
    })
    rememberConversationOrdersLookup("531417376", LOOKUP_PHONE, [exchangeOrder])

    const reply = await resolveOrderShippingReply({
      body: OPENING,
      phone: WHATSAPP,
      history: [],
    })

    assert.doesNotMatch(reply, /לא מצאתי הזמנה\s+⁦?IN264021736/i)
    assert.doesNotMatch(reply, /האם להעביר לנציג/i)
    assert.match(reply, /78248|הזמנה|החלפה/i)
  })
})
