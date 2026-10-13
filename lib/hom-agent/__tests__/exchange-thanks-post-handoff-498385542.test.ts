import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { hasPastTenseHandoffExecutedInText } from "@/lib/agents/post-handoff"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runPreTurnGuards } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

const EXCHANGE_HANDOFF_EXECUTED =
  "*הום בוט :)*\nבשמחה, ברור לי. ההזמנה #78469 עוד לא יצאה אליכם, אז אפשר להחליף בה את הדגם ישירות. אני מעביר עכשיו ליועץ מכירות. הוא יחליף את השטיח בהזמנה ויעזור לבחור דגם אם צריך. אם כבר יש דגם שמצא חן בעיניכם באתר, אפשר לשלוח כאן קישור או מק״ט, וזה יחכה אצל היועץ מעולה, העברתי את השיחה ליועץ מכירות. ניצור קשר בהקדם."

function history498385542(): HistoryMessage[] {
  return [
    {
      role: "user",
      content: "אני רוצה להחליף את השטיח שהזמנתי מכם לשטיח אחר",
    },
    { role: "assistant", content: EXCHANGE_HANDOFF_EXECUTED },
  ]
}

/** Replay 498385542 — thanks after executed sales exchange handoff must not repeat human_sales. */
describe("exchange thanks post-handoff 498385542", () => {
  it("detects past-tense handoff in combined transfer reply", () => {
    assert.equal(hasPastTenseHandoffExecutedInText(EXCHANGE_HANDOFF_EXECUTED), true)
  })

  it("pre-turn acks thanks with reply — not duplicate human_sales", () => {
    const result = runPreTurnGuards({
      turn: { text: "תודה", media: [] },
      history: history498385542(),
      customerName: "לקוח",
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "reply")
    assert.doesNotMatch(result.reply, /העברתי את השיחה/)
  })

  it("hints POST-HANDOFF thanks close — not order-mod re-handoff", () => {
    const hints =
      buildConversationHints({
        body: "תודה",
        history: history498385542(),
      }) ?? ""
    assert.match(hints, /POST-HANDOFF THANKS CLOSE/)
    assert.doesNotMatch(hints, /SALES TRANSFER PROMISED/)
    assert.doesNotMatch(hints, /HANDOFF OFFER PENDING/)
  })
})
