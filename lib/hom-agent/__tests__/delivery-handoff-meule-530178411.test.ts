import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runPreTurnGuards } from "@/lib/hom-agent/pre-turn"

const HANDOFF_REPLY =
  "*הום בוט :)*\nתפארת, מבין שחשוב לך לדעת מתי בדיוק השטיח מגיע. מכאן אני לא רואה מועד אספקה מדויק, לכן אני מעביר את הפנייה לנציג שירות לקוחות. הוא יבדוק את ההזמנה (SO26020329) ויעדכן אותך. ביום האספקה עצמו השליח יתקשר אלייך לפני שהוא מגיע. מעולה, העברתי את השיחה לנציג שירות. ניצור קשר בהקדם."

function historyAfterDeliveryHandoff(): HistoryMessage[] {
  return [
    {
      role: "user",
      content: "לי הודעתם בווצאפ שזה יהיה השבוע",
    },
    { role: "assistant", content: HANDOFF_REPLY },
  ]
}

/** Replay 530178411 — bare מעולה after executed service handoff must warm-close, not re-handoff. */
describe("delivery handoff meule ack 530178411", () => {
  it("pre-turn warm-closes on מעולה after executed service handoff", () => {
    const result = runPreTurnGuards({
      turn: { text: "מעולה", media: [] },
      history: historyAfterDeliveryHandoff(),
      customerName: "תפארת",
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "reply")
    assert.notEqual(result.action, "human_service")
    assert.doesNotMatch(result.reply, /העברתי/)
  })

  it("hints warm close on מעולה after transfer — never repeat handoff", () => {
    const hints = buildConversationHints({
      body: "מעולה",
      history: historyAfterDeliveryHandoff(),
      whatsappPhone: "0501234567",
      customerName: "תפארת",
    })
    assert.match(hints ?? "", /530178411/)
    assert.match(hints ?? "", /never.*human_service|never.*העברתי/i)
  })
})
