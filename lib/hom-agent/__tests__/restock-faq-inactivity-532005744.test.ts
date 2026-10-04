import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { shouldSkipInactivityPingForCompleteReply } from "@/lib/agents/inactivity-policy"
import { CUSTOMER_HEADER, type HistoryMessage } from "@/lib/agents/types"

const STOCK_FAQ_REPLY =
  `${CUSTOMER_HEADER}\n` +
  "כן הילה, השטיח הזה צפוי לחזור למלאי בסביבות 29/10/2026, ורק אז נוכל לשלוח אותו. " +
  "אחרי שהמלאי מתחדש, ההזמנה יוצאת למשלוח. זמן המשלוח הרגיל הוא עד 4 ימי עסקים. " +
  "29/10 הוא תאריך משוער ולא סופי, ולכן אני לא יכול להבטיח לך יום מדויק. " +
  "חברת השליחויות תתקשר אלייך ביום האספקה כדי לתאם את ההגעה."

/** Replay 532005744 — ping after complete stock/delivery FAQ answer. */
describe("restock FAQ inactivity (532005744)", () => {
  it("skips inactivity ping after complete FAQ answer", () => {
    const history: HistoryMessage[] = [
      {
        role: "user",
        content:
          "חידוש המלאי סביבות 29.10 ז''א שרק אז תקבלו שטיח כזה?? תוך כמה זמן יגיע אלי",
      },
      { role: "assistant", content: STOCK_FAQ_REPLY },
    ]
    assert.equal(shouldSkipInactivityPingForCompleteReply(history, "faq"), true)
  })

  it("still pings when bot asked an open question", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "איפה ההזמנה שלי?" },
      { role: "assistant", content: `${CUSTOMER_HEADER}\nמה מספר ההזמנה שלך?` },
    ]
    assert.equal(shouldSkipInactivityPingForCompleteReply(history, "faq"), false)
  })
})
