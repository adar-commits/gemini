import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const PRIOR_HANDOFF =
  "*הום בוט :)* שלום אורנה, מצטער שלא חזרו אלייך מאז יום שני ושחיכית כל כך הרבה. אני מעביר אותך עכשיו לנציג שירות לגבי המוצר הפגום. הצוות זמין כרגע. מעולה, העברתי את השיחה לנציג שירות. ניצור קשר בהקדם."

function history367779250(): HistoryMessage[] {
  return [
    { role: "user", content: "נציג שירות על מוצר פגום" },
    {
      role: "user",
      content:
        "חשבונית מס IN264020383. יש ריח נוראי של צבע/ חומר ייצור ואי אפשר להכניס אותו לחדר.",
    },
    { role: "user", content: "לא עונים לי מאז יום שני בשבוע שעבר" },
    { role: "assistant", content: PRIOR_HANDOFF },
    {
      role: "user",
      content:
        "שבועיים הריח המזעזע לא מתנדף. תשלחו שליח עם שטיח בלי סרחון שיקח את השטיח שיש לי.",
    },
  ]
}

/** Replay 367779250 — «איפה נציג השירות?» after handoff must not duplicate human_service. */
describe("defect rep wait chase 367779250", () => {
  it("where-is-rep chase hints reply — not duplicate handoff", () => {
    const hints =
      buildConversationHints({
        history: history367779250(),
        body: "איפה נציג השירות????",
      }) ?? ""
    assert.match(hints, /SERVICE DEFECT WAIT PING \(533557694 \/ 367779250\)/)
    assert.match(hints, /action: reply/i)
    assert.match(hints, /NEVER duplicate.*human_service/i)
    assert.doesNotMatch(hints, /SERVICE DEFECT QC NO-RESPONSE/)
  })
})
