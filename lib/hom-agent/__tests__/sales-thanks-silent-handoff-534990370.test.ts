import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isResolvedFollowUpThanks,
  isThanksAcknowledgment,
} from "@/lib/agents/conversation-close"
import { shouldSilentAutoAssignOnQuietWindow } from "@/lib/agents/inactivity-policy"
import { runPreTurnGuards } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

/** 534990370 — Sydney custom size sales intake stalled on photo; rep answered; customer thanked. */
describe("534990370 sales thanks after rep answer", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "שטיח סידני בהזמנה לפי מידה" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nבשמחה! לאיזה חלל השטיח מיועד, ואיזו מידה אתה צריך?",
      agent: "sales",
    },
    { role: "user", content: "סלון צבע קרם מידה 300*310" },
    {
      role: "assistant",
      content: "*הום בוט :)*\nמעולה, צבע קרם — רשמתי. מה מידת הספה?",
      agent: "sales",
    },
    { role: "user", content: "ספה 2.8" },
    {
      role: "assistant",
      content: "*הום בוט :)*\nאוקיי, קיבלתי. האם אמור להתאים לבעלי חיים?",
      agent: "sales",
    },
    { role: "user", content: "לא" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nאוקיי, קיבלתי. אפשר לשלוח תמונה אחת ברורה של החלל?",
      agent: "sales",
    },
    { role: "assistant", content: "היי לא ניתן להזמין שטיח סידני לפי מידה.." },
    { role: "assistant", content: "מידה 240*340 יכולה להתאים לספה באורך 280" },
    { role: "user", content: "תודה על המענה" },
  ]

  it("recognizes תודה על המענה as conversation closing", () => {
    assert.equal(isResolvedFollowUpThanks("תודה על המענה"), true)
    assert.equal(isThanksAcknowledgment("תודה על המענה"), true)
  })

  it("pre-turn ends sales photo wait on resolved thanks (534990370)", () => {
    const result = runPreTurnGuards({
      history,
      threadHistory: history,
      turn: { text: "תודה על המענה", media: [] },
      customerName: "יהונתן",
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "end")
    assert.match(result.reply ?? "", /שמחתי לעזור/)
  })

  it("still treats open sales intake as silent-handoff candidate before thanks", () => {
    const beforeThanks = history.slice(0, -1)
    assert.equal(shouldSilentAutoAssignOnQuietWindow(beforeThanks, "sales"), true)
  })
})
