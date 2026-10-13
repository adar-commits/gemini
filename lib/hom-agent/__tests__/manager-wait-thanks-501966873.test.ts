import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isPostHumanHandoff } from "@/lib/agents/post-handoff"
import { runPreTurnGuards } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

const OOO_MANAGER_HANDOFF =
  "*הום בוט :)*\nשלום נעמה, מצטער על ההמתנה. סימנתי את הבקשה שלך לדבר עם מנהל כדחופה. אם תרצי לכתוב בינתיים במה מדובר, זה יעזור לו לחזור אלייך מוכן. כרגע אין נציגי שירות זמינים (שעות הפעילות א'-ה' 09:00-16:00), אבל אל דאגה — קיבלנו את הפנייה וניצור איתכם קשר מיד עם חזרת הצוות לזמינות."

/** Replay 501966873 — thanks after OOO manager handoff must not warm-close the thread. */
describe("manager wait thanks 501966873", () => {
  it("detects post-handoff from after-hours queue commit", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "רוצה לדבר עם מנהל" },
      { role: "assistant", content: OOO_MANAGER_HANDOFF },
    ]
    assert.equal(isPostHumanHandoff("human_service", history), true)
  })

  it("pre-turn acks thanks with reply — not action end — when thread awaits manager callback", () => {
    const threadHistory: HistoryMessage[] = [
      { role: "user", content: "שלום עדין מחכה" },
      { role: "assistant", content: OOO_MANAGER_HANDOFF },
    ]
    const visitHistory: HistoryMessage[] = [
      { role: "assistant", content: OOO_MANAGER_HANDOFF },
    ]

    const result = runPreTurnGuards({
      turn: { text: "תודה", media: [] },
      history: visitHistory,
      threadHistory,
      customerName: "נעמה שניידר",
    })

    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "reply")
    assert.match(result.reply, /הנציג כבר קיבל|יצור קשר/)
    assert.doesNotMatch(result.reply, /שמחתי לעזור היום/)
  })
})
