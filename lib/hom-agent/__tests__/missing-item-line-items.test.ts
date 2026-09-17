import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import {
  buildMissingProductChoicePrompt,
  buildOrderConfirmationPrompt,
  isMissingProductChoicePending,
  isOrderConfirmedInThread,
  mapPriorityOrderRow,
  resolveMissingProductChoice,
  shouldSurfaceOrderLineItems,
} from "@/lib/agents/order-lookup"

describe("missing item line items (532216333 pattern)", () => {
  const order = mapPriorityOrderRow({
    ORDNAME: "SO26021446",
    REFERENCE: "#76360",
    TOTPRICE: 465.5,
    BRANCHNAME: "3000",
    ORDERITEMS_SUBFORM: [
      {
        PARTNAME: "33201138-120170",
        PDES: "שטיח פורמולה 1 קרם",
        VPRICE: 465.5,
      },
      {
        PARTNAME: "40400025-200290",
        PDES: "פוף שאגי",
        VPRICE: 299,
      },
    ],
  })

  it("does not show products on pre-confirm card", () => {
    const prompt = buildOrderConfirmationPrompt(order)
    assert.doesNotMatch(prompt, /שטיח פורמולה/)
    assert.doesNotMatch(prompt, /פוף שאגי/)
  })

  it("shows numbered product pick after confirm in missing_item context", () => {
    const prompt = buildMissingProductChoicePrompt(order, order.lineItems ?? [])
    assert.match(prompt, /1\. שטיח פורמולה 1 קרם/)
    assert.match(prompt, /2\. פוף שאגי/)
    assert.match(prompt, /איזה פריט לא הגיע/)
  })

  it("binds numbered and name answers to displayed options only", () => {
    const items = order.lineItems ?? []
    assert.equal(resolveMissingProductChoice("2", items)?.name, "פוף שאגי")
    assert.equal(resolveMissingProductChoice("פוף שאגי", items)?.sku, "40400025-200290")
  })

  it("detects missing-product choice pending state", () => {
    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nלפי ההזמנה SO26021446, אלה הפריטים:\n1. שטיח\n2. פוף\n\nאיזה פריט לא הגיע?",
        agent: "service",
      },
    ]
    assert.ok(isMissingProductChoicePending(history))
  })

  it("gates product surfacing until order is confirmed", () => {
    const preConfirmHistory: HistoryMessage[] = [
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nאוקיי נדמה לי שמצאתי את ההזמנה (מס׳ הזמנה SO26021446) נכון?",
        agent: "service",
      },
    ]
    assert.equal(isOrderConfirmedInThread(preConfirmHistory), false)
    assert.equal(
      shouldSurfaceOrderLineItems({
        history: preConfirmHistory,
        body: "כן",
        order,
        issueKind: "missing_item",
      }),
      false
    )
    assert.ok(
      shouldSurfaceOrderLineItems({
        history: preConfirmHistory,
        body: "כן",
        order,
        issueKind: "missing_item",
        afterOrderConfirm: true,
      })
    )
  })
})
