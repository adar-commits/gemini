import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import { classifyPostPurchaseCase } from "@/lib/agents/inquiry-intent"
import { isShippingStatusQuestion } from "@/lib/agents/shipping"
import {
  buildOrderConfirmationPrompt,
  buildPreorderAwareStatusReply,
  isServiceOrderIdentificationFlow,
  mapPriorityOrderRow,
} from "@/lib/agents/order-lookup"

/** Replay 532360395 / trainer +972547495083 — not-received carpet is shipping + Pre Order ETA. */
describe("preorder status 532360395", () => {
  const opening = "לא קיבלתי את השטיח שלי"

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

  it("classifies opener as shipping status, not missing_item", () => {
    assert.equal(classifyPostPurchaseCase(opening), null)
    assert.ok(isShippingStatusQuestion(opening))
  })

  it("does not enter service identification after order confirm", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: opening, agent: null },
      {
        role: "assistant",
        content: buildOrderConfirmationPrompt(preorderOrder),
        agent: "faq",
      },
    ]
    assert.equal(isServiceOrderIdentificationFlow(history, "כן נכון"), false)
  })

  it("explains Pre Order ETA instead of unknown-status service handoff", () => {
    const items = (preorderOrder.lineItems ?? []).map((item) => ({
      ...item,
      preorderExpectedDate: "2026-11-15",
    }))
    const reply = buildPreorderAwareStatusReply(preorderOrder, items)
    assert.match(reply, /הזמנה מוקדמת/)
    assert.match(reply, /15\/11\/2026|15\.11\.2026/)
    assert.doesNotMatch(reply, /אז מסכם את הפנייה/)
    assert.doesNotMatch(reply, /תועבר להמשך טיפול/)
    assert.doesNotMatch(reply, /פריט חסר/)
  })
})
