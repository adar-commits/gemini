import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import { isShippingThreadFromHistory } from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runPreTurnGuards } from "@/lib/hom-agent/pre-turn"

const HANDOFF_REPLY =
  "*הום בוט :)*\nהיי ארינה! באופן כללי שטיחים מגיעים עד 4 ימי עסקים מרגע ההזמנה, וחברת השליחויות יוצרת קשר ביום האספקה עצמו כדי לתאם את ההגעה. כדי לקבל צפי מדויק להזמנה 77670, אני מעביר את הפנייה לנציג שירות שיבדוק ויעדכן אותך כאן."

function historyAfterServiceHandoff(): HistoryMessage[] {
  return [
    {
      role: "user",
      content: "היי מתי אני אקבל את השטיח שהזמנתי?",
    },
    { role: "user", content: "הזמנה 77670" },
    { role: "assistant", content: HANDOFF_REPLY },
  ]
}

/** Replay 533428072 — thanks after executed service handoff must warm-close, not re-handoff. */
describe("ETA handoff thanks 533428072", () => {
  it("recognizes shipping thread through ETA ask + order id", () => {
    assert.equal(isShippingThreadFromHistory(historyAfterServiceHandoff()), true)
  })

  it("pre-turn warm-closes on thanks after declarative service handoff", () => {
    const result = runPreTurnGuards({
      turn: { text: "תודה", media: [] },
      history: historyAfterServiceHandoff(),
      customerName: "ארינה",
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.notEqual(result.action, "human_service")
    assert.doesNotMatch(result.reply, /העברתי/)
    assert.doesNotMatch(result.reply, /מעולה/)
  })

  it("hints warm close on shipping thanks after service transfer — never repeat handoff", () => {
    const hints = buildConversationHints({
      body: "תודה",
      history: historyAfterServiceHandoff(),
      whatsappPhone: "0501234567",
      customerName: "ארינה",
    })
    assert.match(hints ?? "", /533428072/)
    assert.match(hints ?? "", /never.*human_service|never.*העברתי/i)
  })
})
