import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  bindPriorityApiLogContext,
  resetPriorityApiTurnState,
} from "@/lib/agents/priority-webhook"
import {
  buildOrderConfirmationPrompt,
  buildOrderPickExhaustedPhoneRecheckPrompt,
  mapPriorityOrderRow,
  resolveOrderShippingReply,
} from "@/lib/agents/order-lookup"
import {
  clearOrdersLookupCache,
  rememberConversationOrdersLookup,
} from "@/lib/agents/order-lookup-cache"
import type { HistoryMessage } from "@/lib/agents/types"

/** 532360395 — after all phone orders rejected, re-confirm lookup phone before handoff. */
describe("order pick exhausted phone recheck 532360395", () => {
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

  it("re-confirms chat phone when both API orders were rejected", async () => {
    clearOrdersLookupCache()
    resetPriorityApiTurnState()
    bindPriorityApiLogContext({
      conversationId: "532360395",
      whatsappPhone,
    })
    rememberConversationOrdersLookup("532360395", lookupPhone, [
      otherOrder,
      preorderOrder,
    ])

    const history: HistoryMessage[] = [
      {
        role: "user",
        content: "לא קיבלתי את השטיח שלי",
      },
      {
        role: "assistant",
        content: buildOrderConfirmationPrompt(otherOrder),
      },
      { role: "user", content: "לא" },
      {
        role: "assistant",
        content: buildOrderConfirmationPrompt(preorderOrder),
      },
    ]

    const reply = await resolveOrderShippingReply({
      body: "לא",
      phone: whatsappPhone,
      history,
    })

    assert.equal(
      reply.trim(),
      buildOrderPickExhaustedPhoneRecheckPrompt(lookupPhone, whatsappPhone).trim()
    )
    assert.match(reply, /ממנו אני מתכתב/)
    assert.doesNotMatch(reply, /נציג שירות/)
  })
})
