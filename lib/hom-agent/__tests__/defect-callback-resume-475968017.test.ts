import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const OOO_HANDOFF =
  "*הום בוט :)* כרגע אין נציגי שירות זמינים (שעות הפעילות א'-ה' 09:00-16:00), אבל אל דאגה — קיבלנו את הפנייה וניצור איתכם קשר מיד עם חזרת הצוות לזמינות."

const SERVICE_SUMMARY =
  "*הום בוט :)* תודה, הבנתי. מצטער לשמוע שהשטיח מתחיל להיפרם. כדי שהנציג לא יצטרך לשאול שוב, זה מה שאעביר לו: • שטיח שנקנה לפני כשנה בסניף איירפורט סיטי • לפי הלקוחות: השטיח מתחיל להיפרם במספר נקודות • נשלחו 2 סרטונים • אביבית ועופר קליין, צור 14 שוהם • טלפון ההזמנה: 052-3996704 זה מדויק, או שחסר משהו?"

function historyBeforeNextDayShalom(): HistoryMessage[] {
  return [
    {
      role: "user",
      content:
        "היי. קנינו שטיח לפני כשנה בסניף אירפורטסיטי. השטיח מתחיל להיפרם במספר נקודות. מה עושים? תודה, קליין אביבית ועופר, צור 14 שוהם.",
    },
    { role: "assistant", content: "*הום בוט :)* … phone confirm …" },
    { role: "user", content: "כן" },
    { role: "assistant", content: SERVICE_SUMMARY },
    { role: "user", content: "מדויק. תודה" },
    { role: "assistant", content: OOO_HANDOFF },
    { role: "user", content: "👍" },
  ]
}

/** Replay 475968017 — next-day שלום must not reset to «משהו אחר». */
describe("defect callback resume 475968017", () => {
  it("hints callback resume on שלום after OOO defect handoff", () => {
    const hints =
      buildConversationHints({
        history: historyBeforeNextDayShalom(),
        body: "שלום",
      }) ?? ""
    assert.match(hints, /SERVICE DEFECT CALLBACK RESUME \(475968017\)/)
    assert.match(hints, /Never.*משהו אחר/i)
  })

  it("wrong production reply asked משהו אחר on שלום", () => {
    const bad =
      "*הום בוט :)* שלום! 😊 במה אפשר לעזור? זה בקשר לשטיח שמתחיל להיפרם, או משהו אחר?"
    assert.match(bad, /משהו אחר/)
  })
})
