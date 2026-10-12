import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { runPreTurnGuards } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

const TRANSFER_PROSE =
  "*הום בוט :)*\nאני מעביר עכשיו לנציג שירות. הוא יעדכן אתכם בהקדם."

const RESOLVED_FAQ_AFTER_PROSE =
  "*הום בוט :)*\nבדקתי — ההזמנה בדרך ללקוח. שמחתי לעזור! 😊"

/** Replay 321404113 — thanks must execute human_service, not warm-close end, when transfer prose is in thread. */
describe("thanks after transfer prose 321404113", () => {
  it("binds human_service on thanks when last visit turn is FAQ but thread has unexecuted transfer prose", () => {
    const threadHistory: HistoryMessage[] = [
      { role: "user", content: "מתי יגיע השטיח?" },
      { role: "assistant", content: TRANSFER_PROSE },
      { role: "assistant", content: RESOLVED_FAQ_AFTER_PROSE },
    ]
    const visitHistory: HistoryMessage[] = [
      { role: "assistant", content: RESOLVED_FAQ_AFTER_PROSE },
    ]

    const result = runPreTurnGuards({
      turn: { text: "תודה", media: [] },
      history: visitHistory,
      threadHistory,
      customerName: "ציפי סוסן",
    })

    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "human_service")
    assert.match(result.reply, /העברתי|נציג/)
    assert.doesNotMatch(result.reply, /שמחתי לעזור היום/)
  })

  it("still warm-closes on thanks when thread has no transfer prose", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "מה שעות הסניף?" },
      { role: "assistant", content: RESOLVED_FAQ_AFTER_PROSE },
    ]

    const result = runPreTurnGuards({
      turn: { text: "תודה", media: [] },
      history,
      threadHistory: history,
      customerName: "ציפי",
    })

    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "end")
    assert.match(result.reply, /שמחתי לעזור/)
  })
})
