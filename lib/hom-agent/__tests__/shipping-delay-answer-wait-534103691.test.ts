import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isOpenShippingDelayServiceHandoffThread,
  isShippingDelayHandoffAnswerWaitFollowUp,
} from "@/lib/agents/post-handoff"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const FIRST_HANDOFF =
  "*הום בוט :)* מעין, מצטער שההזמנה עדיין לא הגיעה. מעביר עכשיו לנציג שירות: • SO26024849 • מועד עד 8/10 • טלפון 052-3408589 מעולה, העברתי את השיחה לנציג שירות. ניצור קשר בהקדם."

const LIVE_REP = "היי מדברת תהילה מהשירות לקוחות"

const URGENT_HANDOFF =
  "*הום בוט :)* שלום מעין, מצטער שעדיין לא קיבלת תשובה. סימנתי את הפנייה כדחופה. מעולה, העברתי את השיחה לנציג שירות. ניצור קשר בהקדם."

const WAIT_PING = "שלום ממתינה לתשובה"

const BAD_FAQ_REPLY =
  "*הום בוט :)* שלום מעין, מצטער שעוד לא חזרו אלייך. הבקשה שלך לקבל מועד אספקה רשומה אצל צוות השירות. נציגי השירות זמינים היום עד 16:00."

function historyBeforeWaitPing(): HistoryMessage[] {
  return [
    { role: "user", content: "מתי תספקו את השטיח????" },
    { role: "assistant", content: FIRST_HANDOFF },
    { role: "user", content: "מבקשת ליצור איתי קשר בדחיפות !!!" },
    { role: "assistant", content: LIVE_REP },
    { role: "assistant", content: "המשלוח שלך נמצא אצל חברת השליחויות" },
    { role: "user", content: "שלום מחכה לתשובה דחופה !!!!" },
    { role: "assistant", content: URGENT_HANDOFF },
  ]
}

/** Replay 534103691 — answer-wait ping after live rep must not get passive FAQ reply. */
describe("shipping delay answer wait 534103691", () => {
  it("detects open shipping-delay service handoff thread", () => {
    assert.equal(isOpenShippingDelayServiceHandoffThread(historyBeforeWaitPing()), true)
  })

  it("detects answer-wait follow-up", () => {
    assert.equal(
      isShippingDelayHandoffAnswerWaitFollowUp(historyBeforeWaitPing(), WAIT_PING),
      true
    )
  })

  it("hints human_service — not passive FAQ reply", () => {
    const hints =
      buildConversationHints({
        history: historyBeforeWaitPing(),
        body: WAIT_PING,
      }) ?? ""
    assert.match(hints, /SHIPPING DELAY ANSWER WAIT \(534103691\)/)
    assert.match(hints, /human_service/)
    assert.match(hints, /never.*FAQ/i)
  })

  it("bad production reply stayed FAQ without handoff", () => {
    assert.doesNotMatch(BAD_FAQ_REPLY, /human_service/)
    assert.match(BAD_FAQ_REPLY, /צוות השירות/)
  })
})
