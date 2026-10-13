import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isRefundCreditPostHandoffStatusFollowUp,
  isPostHumanHandoff,
} from "@/lib/agents/post-handoff"
import { isOpenRefundCreditFollowUpThread } from "@/lib/agents/service-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const OPENING =
  "היי מה נשמע ? הייתי אמורה לקבל החזר על הקנייה שרכשתי אצלכם כליל אור"

const BRANCH_RETURN = "בסניף לא זוכרת מתי לפני בערך שבועיים"

const HANDOFF =
  "*הום בוט :)* מצטער שזה מתעכב, כליל. זיכוי אמור להתקבל עד 7 ימי עסקים ממועד ביטול העסקה, ושבועיים זה כבר יותר מזה. אני מעביר את הפנייה לנציג שירות לבירור דחוף: • החזרת מוצר בסניף לפני כשבועיים בערך • הזיכוי עדיין לא התקבל • טלפון: 0523737789 הנציג ימשיך איתך כאן בהקדם מעולה, העברתי את השיחה לנציג שירות. ניצור קשר בהקדם."

const CHASE = "מה קורה עם זה"

function history532600018BeforeChase(): HistoryMessage[] {
  return [
    { role: "user", content: OPENING },
    {
      role: "assistant",
      content:
        "*הום בוט :)* היי כליל, הכל טוב, תודה ששאלת 🙂 אני אעזור לך לבדוק מה קורה עם ההחזר. מתי החזרת את המוצר או ביטלת את העסקה? והאם זה היה בסניף או עם שליח?",
    },
    { role: "user", content: BRANCH_RETURN },
    { role: "assistant", content: HANDOFF },
  ]
}

/** Replay 532600018 — after branch-refund human_service, status chase must not duplicate handoff. */
describe("refund branch handoff wait 532600018", () => {
  it("detects open branch refund credit thread", () => {
    assert.equal(isOpenRefundCreditFollowUpThread(history532600018BeforeChase()), true)
    assert.equal(isPostHumanHandoff(null, history532600018BeforeChase()), true)
  })

  it("detects post-handoff status follow-up", () => {
    assert.equal(
      isRefundCreditPostHandoffStatusFollowUp(history532600018BeforeChase(), CHASE),
      true
    )
  })

  it("hints reply — not duplicate human_service", () => {
    const hints =
      buildConversationHints({
        history: history532600018BeforeChase(),
        body: CHASE,
      }) ?? ""
    assert.match(hints, /REFUND CREDIT HANDOFF WAIT \(532600018\)/)
    assert.match(hints, /action: reply/i)
    assert.match(hints, /never.*human_service/i)
  })
})
