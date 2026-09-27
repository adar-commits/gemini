import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isServiceOrderIdentificationFlow } from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

/** 532732459 — shipping thread order confirm must not open service rep summary. */
describe("shipping confirm not service summary (532732459)", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "מתי יגיע המשלוח של ההזמנה שלי?" },
    { role: "assistant", content: "האם מספר הטלפון לחיפוש הוא 0501234567?" },
    { role: "user", content: "כן" },
    {
      role: "assistant",
      content:
        "נדמה לי שמצאתי את ההזמנה SO26012345 (מס׳ הזמנה #12345) — זו ההזמנה?",
    },
  ]

  it("does not treat shipping-only confirm as service order identification", () => {
    assert.equal(isServiceOrderIdentificationFlow(history, "כן"), false)
  })

  it("hints to deliver shipping status after confirm, not service summary", () => {
    const hints = buildConversationHints({
      history,
      body: "כן",
      whatsappPhone: "+972501234567",
    })
    assert.match(hints ?? "", /532732459|shipping status|delivery\/status/i)
    assert.doesNotMatch(hints ?? "", /SERVICE ORDER ID/i)
  })
})
