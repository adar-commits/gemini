import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runPreTurnGuards } from "@/lib/hom-agent/pre-turn"
import { isDesignerCodeRequestPending } from "@/lib/agents/service-intake"
import type { HistoryMessage } from "@/lib/agents/types"

const CUSTOMER = "רוני"
const DESIGNER_CODE_ASK =
  "היי רוני! ההזמנה עדיין לא שולמה, אז נציג שירות יוכל לבדוק אם אפשר להוסיף את קוד המעצבת לפני התשלום. " +
  "מה קוד המעצבת? אצרף אותו לפנייה כדי שהנציג יטפל בזה מיד."

function historyAfterDesignerCodeAsk(): HistoryMessage[] {
  return [
    { role: "user", content: "עשיתי הזמנה ושכחתי להזין את קוד המעצbת" },
    {
      role: "assistant",
      content: `*הום בוט :)*\n${DESIGNER_CODE_ASK}`,
    },
  ]
}

/** Replay 534090339 — thanks after designer-code ask must not warm-close. */
describe("designer code thanks (534090339)", () => {
  it("detects pending designer code request from bot question", () => {
    assert.equal(isDesignerCodeRequestPending(historyAfterDesignerCodeAsk()), true)
  })

  it("pre-turn keeps thread open on thanks — no שמחתי לעזור", () => {
    const result = runPreTurnGuards({
      turn: { text: "תודה רבה", media: [] },
      history: historyAfterDesignerCodeAsk(),
      customerName: CUSTOMER,
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "reply")
    assert.match(result.reply, /בשמחה/)
    assert.match(result.reply, /קוד/)
    assert.doesNotMatch(result.reply, /שמחתי לעזור/)
  })

  it("hints LLM not to end on thanks while designer code is pending", () => {
    const hints = buildConversationHints({
      body: "תודה רבה",
      history: historyAfterDesignerCodeAsk(),
      whatsappPhone: "0501234567",
      customerName: CUSTOMER,
    })
    assert.match(hints ?? "", /DESIGNER CODE PENDING/i)
    assert.doesNotMatch(hints ?? "", /THANKS AFTER RESOLVED THREAD/i)
  })
})
