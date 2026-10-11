import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const LOOKUP_FAIL_OFFER =
  "*הום בוט :)* תודה רעות. מצטער, כרגע לא הצלחתי למשוך את סטטוס ההזמנה מהמערכת לפי המספר 0528501455. רוצה שאעביר לנציג שירות שיבדוק את ההזמנה שלך ויעדכן גם את מספר הבניין?"

const OFFLINE_QUEUE =
  "*הום בוט :)* כרגע אין נציגי שירות זמינים, אבל אל דאגה — קיבלנו את הפנייה. הצוות חוזר ביום ראשון מ-09:00, ניצור איתכם קשר."

function history424571373(): HistoryMessage[] {
  return [
    { role: "user", content: "מתי זה מגיע ??" },
    { role: "user", content: "מספר טלפןן 0528501455" },
    { role: "assistant", content: LOOKUP_FAIL_OFFER },
    { role: "user", content: "כן" },
    { role: "assistant", content: OFFLINE_QUEUE },
  ]
}

/** Replay 424571373 — wait ping after offline human_service on failed phone lookup. */
describe("order lookup wait ping 424571373", () => {
  it("? wait ping hints reply — not duplicate handoff", () => {
    const hints =
      buildConversationHints({
        history: history424571373(),
        body: "?",
      }) ?? ""
    assert.match(hints, /SERVICE SHIPPING STATUS WAIT PING \(274323208\)/)
    assert.match(hints, /action: reply/i)
    assert.match(hints, /NEVER duplicate.*human_service/i)
  })
})
