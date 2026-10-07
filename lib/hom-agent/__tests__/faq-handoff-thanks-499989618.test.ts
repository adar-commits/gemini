import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runPreTurnGuards } from "@/lib/hom-agent/pre-turn"

const HANDOFF_REPLY =
  "*הום בוט :)*\nבכיף, אני מעביר עכשיו לנציג שירות. הנציג יבדוק אם שטיח בל 01 בז׳ (BELL) מתאים לכביסה ואיך הכי נכון לנקות אותו."

function historyAfterServiceHandoff(): HistoryMessage[] {
  return [
    {
      role: "user",
      content: "היי רציתי לבדוק האם אפשר לכבס את השטיח הזה-",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* היי עדי! זה תלוי בדגם. מה שם הדגם של השטיח?",
    },
    { role: "user", content: "שטיח בל 01 בז' BELL" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* תודה! לגבי בל 01 בז׳ אין לי פה נתון מאומת אם הוא רחיץ. להעביר לנציג שירות שיבדוק את הדגם?",
    },
    { role: "user", content: "תבדוק בבקשה עם בן אדם" },
    { role: "assistant", content: HANDOFF_REPLY },
  ]
}

/** Replay 499989618 — FAQ/service thanks after executed handoff must warm-close, not re-handoff. */
describe("FAQ handoff thanks 499989618", () => {
  it("pre-turn warm-closes on thanks after declarative service handoff (non-shipping)", () => {
    const result = runPreTurnGuards({
      turn: { text: "תודה", media: [] },
      history: historyAfterServiceHandoff(),
      customerName: "עדי",
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "reply")
    assert.doesNotMatch(result.reply, /העברתי/)
    assert.doesNotMatch(result.reply, /מעולה/)
  })

  it("hints warm close on FAQ thanks after service transfer — never repeat handoff", () => {
    const hints = buildConversationHints({
      body: "תודה",
      history: historyAfterServiceHandoff(),
      whatsappPhone: "0501234567",
    })
    assert.match(hints ?? "", /499989618/)
    assert.match(hints ?? "", /never.*human_service|never.*העברתי/i)
  })
})
