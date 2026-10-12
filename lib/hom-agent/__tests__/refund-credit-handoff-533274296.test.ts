import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isOpenRefundCreditFollowUpThread } from "@/lib/agents/service-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const TRANSFER_REPLY_ONLY =
  "*הום בוט :)* מצטער שעדיין לא קיבלת אישור על הזיכוי. עברו כבר יותר מ-7 ימי עסקים מאז שהשטיח נאסף, ובנוסף הבקשה בפורטל נתקעה בשלב האחרון. לכן אני מעביר את הפנייה עכשיו לנציג שירות, שיבדוק את הזיכוי בדחיפות."

function history533274296(): HistoryMessage[] {
  return [
    { role: "user", content: "היי לכם" },
    { role: "user", content: "לגבי הזיכוי" },
    { role: "user", content: "לא קיבלתי אישור על הזיכוי" },
    { role: "assistant", content: TRANSFER_REPLY_ONLY },
    { role: "user", content: "אוקיי" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* בשמחה! הנציג כבר קיבל את הפנייה ויצור קשר בהקדם.",
    },
  ]
}

/** Replay 533274296 — credit approval after pickup; rep-join chase must not duplicate handoff. */
describe("refund credit handoff 533274296", () => {
  it("detects open refund credit thread from approval ask + pickup in thread", () => {
    assert.equal(isOpenRefundCreditFollowUpThread(history533274296()), true)
  })

  it("opening credit approval hint requires human_service with transfer — not reply-only", () => {
    const hints =
      buildConversationHints({
        history: [
          { role: "user", content: "לגבי הזיכוי" },
          { role: "user", content: "לא קיבלתי אישור על הזיכוי" },
        ],
        body: "לא קיבלתי אישור על הזיכוי",
      }) ?? ""
    assert.match(hints, /REFUND STATUS FOLLOW-UP \(295276261 \/ 533274296/)
    assert.match(hints, /human_service/)
    assert.match(hints, /Never.*הנציג כבר קיבל/i)
  })

  it("rep join chat wait after transfer prose hints reply — not duplicate human_service", () => {
    const hints =
      buildConversationHints({
        history: history533274296(),
        body: "מתי הוא יעלה לצט",
      }) ?? ""
    assert.match(hints, /REFUND CREDIT REP JOIN WAIT \(533274296\)/)
    assert.match(hints, /`action: reply`/i)
    assert.match(hints, /\*\*never\*\* duplicate/i)
    assert.match(hints, /second \*\*`human_service`\*\*/i)
  })
})
