import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import {
  buildPreorderAwareStatusReply,
  isKnownOrderConfirmPending,
  mapPriorityOrderRow,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"

const COMPLAINT =
  "בקישור למעקב לא נראה שיש שינוי מאז שהזמנתי, ב19.9. היה כתוב שהשטיח במלאי, ושזה מגיע יום למחרת אך לא קרה"

/** 532581645 — tracking complaint after SO confirm must lookup first; Pre Order must not echo next-day promise. */
describe("preorder false delivery promise 532581645", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "היי\nאשמח לדעת מה קורה עם השטיח שהזמנתי" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nהיי זוהר!\n\nלבדוק את ההזמנה SO26022899, זו שהגיעה עם הקבלה והקישור למעקב?",
    },
  ]

  const preorderOrder = mapPriorityOrderRow({
    ORDNAME: "SO26022899",
    REFERENCE: "#77200",
    TOTPRICE: 890,
    BRANCHNAME: "3000",
    ORDSTATUSDES: "בביצוע",
    ZPIT_DELSTATUSCODE: null,
    ZPIT_DELSTATUSDES: null,
    ORDERITEMS_SUBFORM: [
      {
        PARTNAME: "31502091-200290",
        PDES: "סידני 02 קרם-בז'",
        TQUANT: 1,
        VPRICE: 890,
        ORDISTATUSDES: "Pre Order",
      },
    ],
  })

  it("keeps known-order confirm pending on tracking complaint without bare כן", () => {
    assert.equal(isKnownOrderConfirmPending(history), true)
  })

  it("hints lookup before handoff and forbids echoing in-stock/next-day promise", () => {
    const hints = buildConversationHints({ body: COMPLAINT, history })
    assert.match(hints ?? "", /532581645/)
    assert.match(hints ?? "", /lookup_order_status/)
    assert.match(hints ?? "", /Never human_service before lookup/i)
    assert.match(hints ?? "", /never repeat their in-stock\/next-day site wording/i)
  })

  it("preorder status reply states no next-day in-stock shipping promise", () => {
    const items = (preorderOrder.lineItems ?? []).map((item) => ({
      ...item,
      preorderExpectedDate: "2026-11-15",
    }))
    const reply = buildPreorderAwareStatusReply(preorderOrder, items)
    assert.match(reply, /לא חלה הבטחת משלוח ממלאי/)
    assert.match(reply, /יום-למחרת/)
    assert.match(reply, /הזמנה מוקדמת/)
    assert.doesNotMatch(reply, /הופיעה במלאי/)
    assert.doesNotMatch(reply, /היה אמור להגיע/)
  })
})
