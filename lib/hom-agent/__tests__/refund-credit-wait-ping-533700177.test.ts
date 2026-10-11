import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isOpenRefundCreditFollowUpThread } from "@/lib/agents/service-intake"
import { isActiveSalesConsultation } from "@/lib/agents/sales-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

function history533700177(): HistoryMessage[] {
  return [
    { role: "user", content: "החזרתי אותו" },
    { role: "user", content: "אתם עושים לי זיכוי?" },
    { role: "user", content: "???" },
  ]
}

/** Replay 533700177 — refund/credit chase; wait ping must not resume sales intake. */
describe("refund credit wait ping (533700177)", () => {
  it("detects open refund credit follow-up thread", () => {
    assert.equal(isOpenRefundCreditFollowUpThread(history533700177()), true)
  })

  it("blocks active sales consultation on open refund credit case", () => {
    assert.equal(isActiveSalesConsultation(history533700177(), "faq"), false)
  })

  it("emits refund credit wait ping hint forbidding sales handoff", () => {
    const hints =
      buildConversationHints({
        history: history533700177(),
        body: "???",
      }) ?? ""
    assert.match(hints, /REFUND CREDIT WAIT PING \(533700177\)/)
    assert.match(hints, /human_service/)
    assert.match(hints, /Never.*sales intake/i)
    assert.match(hints, /REFUND STATUS FOLLOW-UP/)
  })
})
