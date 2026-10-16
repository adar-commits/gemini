import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isReplacementDeliveredStillWrongThread,
  isReplacementDeliveredWrongProgressChaseFollowUp,
} from "@/lib/agents/post-handoff"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const OCT15_BODY =
  "אני עדיין ממתינה לתגובה שלכם איך מתקדמים\nאני  עם מוצר יקר שלא תואם את מה שמופיע בתמונות באתר כבר מסוף ספטמבר.\nמבקשת לחזור אלי דחוף עם פתרון"

const BAD_FAQ_REPLY =
  "*הום בוט :)* דיאנה… צוות השירות זמין עכשיו. העברתי את הפנייה לנציג שירות… • השטיח החלופi שהובטח עדיין לא הגיע"

function historyThroughOct14(): HistoryMessage[] {
  return [
    {
      role: "user",
      content:
        "שלום מבקשת לחזור אלי עוד היום עם תאום האספקה… במידה ולא תבוצע החלפה לשטיח תקין עד מחר, ביטול עיסקה",
    },
    {
      role: "assistant",
      content: "*הום בוט :)* … אני מעביר עכשיו את הפנייה לנציג שירות ומסימן אותה כדחופה",
    },
    { role: "user", content: "כן" },
    {
      role: "assistant",
      content: "*הום בוט :)* תודה, דיאנה. העברתי את הפנייה לנציג שירות וסימנתi אותה כדחופה",
    },
    {
      role: "user",
      content:
        "שלום הבוקר הגיע שליח עם השטיח… השטיח החלופi עם אותה הסיומת שלא כמו שמופיע באתר… ביטול עיסקה",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* … העברתi עכשיו לנציג שירות… הפנייה פתוחה מ-29/9, והשטיח החלופi עדיין לא הגיע",
    },
    { role: "user", content: "אני עדיין ממתינה לתגובתכם" },
    {
      role: "assistant",
      content: "*הום בוט :)* … מעולה, העברתi את השיחה לנציג שירות. ניצור קשר בהקדם.",
    },
  ]
}

/** Replay 533162865 — Oct 15 progress chase must not get NEW VISIT FAQ + reply handoff. */
describe("replacement progress chase handoff 533162865", () => {
  it("detects delivered-wrong progress chase follow-up", () => {
    const history = historyThroughOct14()
    assert.equal(isReplacementDeliveredStillWrongThread(history), true)
    assert.equal(
      isReplacementDeliveredWrongProgressChaseFollowUp(history, OCT15_BODY),
      true
    )
  })

  it("hints human_service progress chase — not NEW VISIT", () => {
    const hints =
      buildConversationHints({
        history: historyThroughOct14(),
        body: OCT15_BODY,
        visit: {
          gapDays: 1,
          previousVisitAt: "2026-10-12T07:47:04.000Z",
          anchor: null,
          fresh: true,
        },
      }) ?? ""
    assert.match(hints, /REPLACEMENT DELIVERED WRONG PROGRESS CHASE \(533162865\)/)
    assert.match(hints, /human_service/)
    assert.doesNotMatch(hints, /NEW VISIT \(228989877\)/)
    assert.doesNotMatch(hints, /Treat this message as a fresh inquiry/i)
  })

  it("production FAQ violation used reply with transfer prose and stale delivery", () => {
    assert.match(BAD_FAQ_REPLY, /העברתי/)
    assert.match(BAD_FAQ_REPLY, /עדיין לא הגיע/)
  })
})
