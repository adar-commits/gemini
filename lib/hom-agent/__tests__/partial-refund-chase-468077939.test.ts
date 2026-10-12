import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isActiveSalesConsultation } from "@/lib/agents/sales-intake"
import {
  isPartialRefundChaseThread,
} from "@/lib/agents/service-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

function openingHistory468077939(): HistoryMessage[] {
  return [
    { role: "user", content: "היי איך לא ראיתי עדיין את הזיכוי?" },
    { role: "user", content: "את זה כן" },
    { role: "user", content: "השני לא" },
  ]
}

/** Replay 468077939 — partial refund on cancelled order; opening must hand off, not reply-only. */
describe("partial refund chase (468077939)", () => {
  it("detects partial refund chase thread from opening messages", () => {
    assert.equal(isPartialRefundChaseThread(openingHistory468077939()), true)
  })

  it("blocks active sales consultation on partial refund chase", () => {
    assert.equal(isActiveSalesConsultation(openingHistory468077939(), "faq"), false)
  })

  it("emits partial refund chase hint requiring human_service on opening", () => {
    const hints =
      buildConversationHints({
        history: openingHistory468077939(),
        body: "השנi לא",
      }) ?? ""
    assert.match(hints, /PARTIAL REFUND CHASE \(468077939\)/)
    assert.match(hints, /human_service/)
    assert.match(hints, /Never.*action: reply.*only/i)
  })

  it("binds wait ping after partial refund opening — not generic wait ping", () => {
    const history: HistoryMessage[] = [
      ...openingHistory468077939(),
      {
        role: "assistant",
        content:
          "*הום בוט :)* היי נוי, מצטער שהזיכוי השני עדיין לא הופיע. עברו כבר יותר מ-7 ימי עסקים מהביטול, ולכן נציג שירות צריך לבדוק את זה מול חברת האשראי.",
      },
      { role: "user", content: "?" },
    ]
    const hints =
      buildConversationHints({
        history,
        body: "?",
      }) ?? ""
    assert.match(hints, /PARTIAL REFUND WAIT PING \(468077939\)/)
    assert.match(hints, /human_service/)
    assert.doesNotMatch(hints, /WAIT PING \(\? \/ \?\? \/ הלו\?\): customer checks if anyone is still here/)
  })
})
