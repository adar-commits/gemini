import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isActiveSalesConsultation } from "@/lib/agents/sales-intake"
import { isPostHumanHandoff } from "@/lib/agents/post-handoff"
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

  it("after human_service — ??? wait ping must not duplicate handoff (468077939 Oct 13)", () => {
    const handoff =
      "*הום בוט :)* סליחה על ההמתנה, נוי. אני מעביר עכשיו לנציג שירות לקוחות לבדיקה דחופה של הזיכוי השני מול חברת האשראי (הזמנה SO26021262). הנציג ימשיך איתך כאן בצ׳אט. מעולה, העברתי את השיחה לנציג שירות. ניצור קשר בהקדם."
    const history: HistoryMessage[] = [
      ...openingHistory468077939(),
      {
        role: "assistant",
        content:
          "*הום בוט :)* היי נוי, מצטער שהזיכוי השני עדיין לא הופיע. עברו כבר יותר מ-7 ימי עסקים מהביטול, ולכן נציג שירות צריך לבדוק את זה מול חברת האשראי.",
      },
      { role: "user", content: "?" },
      { role: "assistant", content: handoff },
      { role: "user", content: "???" },
    ]
    assert.equal(isPostHumanHandoff(null, history), true)
    const hints =
      buildConversationHints({
        history,
        body: "???",
      }) ?? ""
    assert.match(hints, /PARTIAL REFUND HANDOFF WAIT \(468077939\)/)
    assert.match(hints, /action: reply/i)
    assert.match(hints, /never.*human_service/i)
  })
})
