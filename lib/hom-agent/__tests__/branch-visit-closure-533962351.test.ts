import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { shouldSilentAutoAssignOnQuietWindow } from "@/lib/agents/inactivity-policy"
import {
  customerRespondedToHandoffWithoutConfirm,
  isHumanHandoffAffirmation,
  isHumanHandoffPending,
} from "@/lib/agents/off-topic"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

/** 533962351 — stock check handoff offer, promotions pivot, visit closure → no silent assign. */
describe("branch visit closure 533962351", () => {
  const handoffOffer =
    "*הום בוט :)* בדקתי זמינות לדגם 09900027-120170 בסניף הכי. לפי הנתונים במערכת לא מופיע מלאי בסניף הכי כרגע — כדאי לפנות לסניף לוודא. האם להעביר ליועץ מכירות שיבדוק ויאמת?"

  const historyAfterVisit: HistoryMessage[] = [
    { role: "user", content: "הי,ראיתי באתר שטיח ,אפשר לבוא לראות ?" },
    { role: "assistant", content: handoffOffer, agent: "sales" },
    { role: "user", content: "יש מבצעים?" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* בדקתי בשבילכם 😊 כן 😊 כרגע יש 2 מבצעים פעילים. אם צריך — אפשר להעביר ליועץ מכירות",
      agent: "faq",
    },
    { role: "user", content: "אגיע לשם \nתודה" },
  ]

  it("visit + thanks is not handoff confirm", () => {
    assert.equal(isHumanHandoffAffirmation("אגיע לשם \nתודה"), false)
  })

  it("detects non-confirm reply after handoff offer", () => {
    assert.equal(isHumanHandoffPending(historyAfterVisit), true)
    assert.equal(customerRespondedToHandoffWithoutConfirm(historyAfterVisit), true)
    assert.equal(shouldSilentAutoAssignOnQuietWindow(historyAfterVisit, "faq"), false)
  })

  it("hints warm close — not handoff pending", () => {
    const hints = buildConversationHints({
      history: historyAfterVisit,
      body: "אגיע לשם \nתודה",
      whatsappPhone: "+972500000000",
    })
    assert.notEqual(hints, null)
    assert.match(hints!, /NON-CONFIRM REPLY \(533962351\)/)
    assert.match(hints!, /\*\*never\*\* `human_sales`/i)
    assert.doesNotMatch(hints!, /HANDOFF OFFER PENDING:/)
  })
})
