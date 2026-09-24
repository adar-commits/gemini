import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildNeverStuckReply } from "@/lib/agent-core/fallbacks"
import {
  buildOrderConfirmationPrompt,
  buildOrderPickExhaustedPhoneRecheckPrompt,
  historyHasOrderPickExhaustedRecheck,
  isPhoneLookupConfirmPending,
  mapPriorityOrderRow,
  pendingOrderNumberFromHistory,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const whatsappPhone = "+972547495083"
const lookupPhone = "0547495083"

const preorderOrder = mapPriorityOrderRow({
  ORDNAME: "SO26021446",
  REFERENCE: "#76360",
  TOTPRICE: 465.5,
  BRANCHNAME: "3000",
  ORDSTATUSDES: "בביצוע",
  ZPIT_DELSTATUSCODE: null,
  ZPIT_DELSTATUSDES: null,
  ORDERITEMS_SUBFORM: [
    {
      PARTNAME: "33201138-120170",
      PDES: "מירוץ מכוניות פורמולה 1 קרם אפור 170*120 FORMULA 1",
      TQUANT: 1,
      VPRICE: 465.5,
      ORDISTATUSDES: "Pre Order",
    },
  ],
})

const otherOrder = mapPriorityOrderRow({
  ORDNAME: "SO26019999",
  REFERENCE: "#70001",
  TOTPRICE: 120,
  BRANCHNAME: "3000",
  ORDSTATUSDES: "בביצוע",
  ZPIT_DELSTATUSCODE: "2",
  ZPIT_DELSTATUSDES: "משלוח נוצר",
})

function historyThroughPhoneRecheck(): HistoryMessage[] {
  return [
    { role: "user", content: "לא קיבלתי את השטיח שלי" },
    { role: "assistant", content: buildOrderConfirmationPrompt(otherOrder) },
    { role: "user", content: "לא" },
    { role: "assistant", content: buildOrderConfirmationPrompt(preorderOrder) },
    { role: "user", content: "לא\nאולי כן?" },
    {
      role: "assistant",
      content: buildOrderPickExhaustedPhoneRecheckPrompt(lookupPhone, whatsappPhone),
    },
  ]
}

/** 532360395 — late order-card confirm during phone recheck must not become never-stuck. */
describe("phone recheck order confirm 532360395", () => {
  it("keeps the last order card as candidate after exhausted phone recheck", () => {
    const history = historyThroughPhoneRecheck()
    assert.equal(isPhoneLookupConfirmPending(history), true)
    assert.equal(historyHasOrderPickExhaustedRecheck(history), true)
    assert.equal(pendingOrderNumberFromHistory(history), "76360")
  })

  it("hints lookup on card confirm with a side size question, not never-stuck", () => {
    const history = historyThroughPhoneRecheck()
    const body = "כן זה ההזמנה, יש בגדלים אחרים?"
    const hints = buildConversationHints({ body, history, whatsappPhone })
    assert.match(hints ?? "", /532360395/)
    assert.match(hints ?? "", /76360/)
    assert.match(hints ?? "", /lookup_order_status/)
    assert.match(hints ?? "", /never "לא הצלחתי להבין"/i)
    assert.doesNotMatch(hints ?? "", /לא הבנתי/)
    assert.notEqual(buildNeverStuckReply().trim(), hints?.trim())
  })
})
