import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isOpenServiceDefectFollowUpThread } from "@/lib/agents/service-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const BRANCH_INTAKE =
  "פניית סניף חדשה סניף: ראשון לציון לקוח/ה: ניר עזרי טלפון: 0507288647 מספר הזמנה / חשבונית: SO26023912 נושא: אחר נציג/ת הסניף: ארטיום הגיע ללקוחה שטיח שלכאורה פגום"

const BRANCH_ACK =
  "היי ניר עזרי 👋 בהמשך לפנייתך בסניף ראשון לציון… אנחנו על זה! 😁 מחלקת שירות הלקוחות קיבלה את פנייתך"

const HANDOFF =
  "*הום בוט :)* מצטער על ההמתנה… SO26023912 — מעולה, העברתי את השיחה לנציג שירות. ניצור קשר בהקדם."

function history533557694(): HistoryMessage[] {
  return [
    {
      role: "user",
      content: "כבר הודעתי אתמול קניתי שטיח קיבלתי אותו פתחתי אותו ויש בו 2 חורים",
    },
    { role: "user", content: "????" },
    { role: "user", content: BRANCH_INTAKE },
    { role: "assistant", content: BRANCH_ACK },
    { role: "user", content: "????" },
    { role: "assistant", content: HANDOFF },
  ]
}

/** Replay 533557694 — defect branch wait ping must not duplicate human_service or wrong name. */
describe("defect branch wait ping 533557694", () => {
  it("detects open service defect follow-up from branch intake", () => {
    assert.equal(isOpenServiceDefectFollowUpThread(history533557694()), true)
  })

  it("?? wait ping hints reply — not duplicate handoff", () => {
    const hints =
      buildConversationHints({
        history: history533557694(),
        body: "???",
      }) ?? ""
    assert.match(hints, /SERVICE DEFECT WAIT PING \(533557694/)
    assert.match(hints, /SO26023912/)
    assert.match(hints, /ניר עזרי/)
    assert.match(hints, /action: reply/i)
    assert.match(hints, /NEVER duplicate.*human_service/i)
    assert.doesNotMatch(hints, /אורטל/)
  })
})
