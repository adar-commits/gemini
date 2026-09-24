import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildOrderConfirmationPrompt, mapPriorityOrderRow } from "@/lib/agents/order-lookup"
import { customerExplicitlyRequestsHuman } from "@/lib/agents/kb-self-service-faq"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const order = mapPriorityOrderRow({
  ORDNAME: "SO26022035",
  REFERENCE: "22035",
  BRANCHNAME: "3000",
  ORDISTATUSDES: "בדרך",
})

describe("QA never-stuck binding hints", () => {
  it("hints lookup on bare כן during order confirm", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "מתי השטיח?" },
      { role: "assistant", content: buildOrderConfirmationPrompt(order) },
    ]
    const hints = buildConversationHints({
      history,
      body: "כן",
      whatsappPhone: "+972501234567",
    })
    assert.match(hints, /ORDER CONFIRM YES/i)
    assert.match(hints, /lookup_order_status/i)
  })

  it("hints handoff on explicit rep request", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "היי" },
      { role: "assistant", content: "במה אוכל לעזור?" },
    ]
    const body = "היי אשמח למענה מנציג ולא מבוט"
    assert.equal(customerExplicitlyRequestsHuman(body), true)
    const hints = buildConversationHints({
      history,
      body,
      whatsappPhone: "+972501234567",
    })
    assert.match(hints, /EXPLICIT REP REQUEST/i)
  })
})
