import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isOpenRefundCreditFollowUpThread } from "@/lib/agents/service-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

/** 530437562 — bot wrote העברתי לנציג with action reply; customer waited for no rep. */
describe("refund credit wait handoff binding 530437562", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "עדין לא קבלתי את הזיכוי של השטיח" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* היי רן, מצטער שהזיכוי עדיין לא הגיע. סימנתי את הפנייה כדחופה לצוות השירות, כדי שיבדקו את הזיכוי על החזרת שטיח בלנקה.",
    },
  ]
  const body = "בוקר טוב עדין לא קבלתי זיכוי על השטיח"

  it("detects open refund credit thread from return context in bot recap", () => {
    assert.equal(isOpenRefundCreditFollowUpThread(history), true)
  })

  it("hints require human_service when promising rep transfer", () => {
    const hints = buildConversationHints({ body, history }) ?? ""
    assert.match(hints, /REFUND STATUS FOLLOW-UP.*530437562/)
    assert.match(hints, /human_service/)
    assert.match(hints, /never.*action: reply.*only/i)
  })
})
