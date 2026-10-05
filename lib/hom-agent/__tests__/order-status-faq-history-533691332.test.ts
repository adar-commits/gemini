import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isOrderModificationRequest } from "@/lib/agents/inquiry-intent"
import {
  buildOrderModificationAwareStatusReply,
  buildOrderStatusReply,
  isOrderDeliveryStatusQuestion,
  isOrderModificationInThread,
  mapPriorityOrderRow,
  shouldUseModificationAwareStatusReply,
} from "@/lib/agents/order-lookup"
import { isShippingStatusQuestion } from "@/lib/agents/shipping"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const EXCHANGE_FAQ =
  "היי, אם אני רוצה להחליף/להחזיר שטיח שקניתי אונליין, זה אפשרי?"
const STATUS_OPENER =
  "היי מה מצב ההזמנה שלי? היום זה יום העסקים ה5 77943"

const PACKAGING_ORDER = mapPriorityOrderRow({
  ORDNAME: "SO26024180",
  REFERENCE: "#77943",
  ZPIT_DELSTATUSCODE: "1",
  ORDSTATUSDES: "ההזמנה התקבלה וכעת בתהליכי אריזה במחסני החברה.",
  ZPIT_UDATE: "2026-10-05T10:00:00+03:00",
})

/** 533691332 — status opener after old exchange FAQ must not sales-handoff for modification. */
describe("order status after exchange FAQ history 533691332", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: EXCHANGE_FAQ },
    {
      role: "assistant",
      content:
        "*הום בוט :)* כן, אפשר גם להחליף וגם להחזיר, תוך 14 יום מקבלת השטיח…",
    },
    {
      role: "assistant",
      content: "*הום בוט :)* הפנייה נסגרה עקב חוסר פעילות 🙏",
    },
  ]

  it("detects status opener, not modification on this turn", () => {
    assert.equal(isShippingStatusQuestion(STATUS_OPENER), true)
    assert.equal(isOrderDeliveryStatusQuestion(STATUS_OPENER), false)
    assert.equal(isOrderModificationRequest(STATUS_OPENER), false)
  })

  it("FAQ history pollutes modification-in-thread but guard skips sales handoff", () => {
    assert.equal(isOrderModificationInThread(history, STATUS_OPENER), true)
    assert.equal(shouldUseModificationAwareStatusReply(history, STATUS_OPENER), false)
  })

  it("status reply has no modification pivot", () => {
    const reply = buildOrderStatusReply(PACKAGING_ORDER)
    assert.match(reply, /בדקתי,/)
    assert.doesNotMatch(reply, /לשנות את ההזמנה/)
    assert.doesNotMatch(reply, /יועץ מכירות/)
  })

  it("modification-aware reply is the wrong template for this scenario", () => {
    const bad = buildOrderModificationAwareStatusReply(
      PACKAGING_ORDER,
      history,
      STATUS_OPENER
    )
    assert.match(bad, /לשנות את ההזמנה/)
    assert.match(bad, /יועץ מכירות/)
  })

  it("hints order status, not sales handoff", () => {
    const hints = buildConversationHints({ body: STATUS_OPENER, history }) ?? ""
    assert.match(hints, /533691332/)
    assert.match(hints, /lookup_order_status|ORDER STATUS OPENING/)
    assert.match(hints, /never human_sales|Never infer/i)
  })
})
