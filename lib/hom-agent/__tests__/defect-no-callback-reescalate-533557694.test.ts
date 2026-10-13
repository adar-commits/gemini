import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const BRANCH_INTAKE =
  "פניית סניף חדשה סניף: ראשון לציון לקוח/ה: ניר עזרי טלפון: 0507288647 מספר הזמנה / חשבונית: SO26023912 נושא: אחר פירוט: הגיע ללקוחה שטיח שלכאורה פגום"

const BRANCH_ACK =
  "היי ניר עזרי 👋 בהמשך לפנייתך בסניף ראשון לציון… מחלקת שירות הלקוחות קיבלה את פנייתך"

const HANDOFF_1 =
  "*הום בוט :)* SO26023912 — שני חורים בשטיח. מעולה, העברתי את השיחה לנציג שירות. ניצור קשר בהקדם."

const HANDOFF_2 =
  "*הום בוט :)* אורטל, מצטער שעדיין לא חזרו אלייך. SO26023912 — מעולה, העברתי את השיחה לנציג שירות. ניצור קשר בהקדם."

const BAD_FAQ_REPLY =
  "*הום בוט :)* אורטל, מבין שאת מחכה… סימנתי אותה שוב לטיפול בעדיפות. צוות השירות זמין היום עד 16:00, ונציג יחזור אלייך כאן בצ׳אט."

function historyBeforeOct13Ping(): HistoryMessage[] {
  return [
    {
      role: "user",
      content: "כבר הודעתי אתמול קניתי שטיח קיבלתי אותו פתחתי אותו ויש בו 2 חורים",
    },
    { role: "user", content: "????" },
    { role: "user", content: BRANCH_INTAKE },
    { role: "assistant", content: BRANCH_ACK },
    { role: "user", content: "שאין מענה" },
    { role: "user", content: "????" },
    { role: "assistant", content: HANDOFF_1 },
    { role: "user", content: "???" },
    { role: "assistant", content: HANDOFF_2 },
    {
      role: "user",
      content: "במידה ולא יחזרו אלי עוג היום. אני מגישה תביעה",
    },
  ]
}

/** Replay 533557694 — FAQ wait ping after repeated handoffs must re-escalate human_service, not NEW VISIT FAQ reply. */
describe("defect no-callback re-escalate 533557694", () => {
  it("hints human_service on ? ping after no-response chase — not NEW VISIT", () => {
    const hints =
      buildConversationHints({
        history: historyBeforeOct13Ping(),
        body: "?????",
        visit: {
          gapDays: 1,
          previousVisitAt: "2026-10-12T06:32:43.000Z",
          anchor: null,
          fresh: true,
        },
      }) ?? ""
    assert.match(hints, /SERVICE DEFECT NO-CALLBACK RE-ESCALATION \(533557694\)/)
    assert.match(hints, /human_service/)
    assert.match(hints, /SO26023912/)
    assert.match(hints, /ניר עזרי/)
    assert.doesNotMatch(hints, /NEW VISIT \(228989877\)/)
    assert.doesNotMatch(hints, /Treat this message as a fresh inquiry/i)
  })

  it("bad production FAQ reply stayed reply without assign", () => {
    assert.doesNotMatch(BAD_FAQ_REPLY, /human_service/)
    assert.match(BAD_FAQ_REPLY, /אורטל/)
  })
})
