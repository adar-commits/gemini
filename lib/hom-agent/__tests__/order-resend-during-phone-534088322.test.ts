import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildOrderNotOnPhoneAskOrderPhonePrompt,
  isAlternatePhoneRequestPending,
  resolveOrderShippingReply,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runStructuredOrderLookupPreTurn } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

const WHATSAPP_PHONE = "+972526109914"

/** 534088322 — order #77260 not on chat phone; customer resent # instead of phone. */
describe("order resend during alternate phone ask 534088322", () => {
  const historyThroughPhoneAsk = (): HistoryMessage[] => {
    const askPhone = buildOrderNotOnPhoneAskOrderPhonePrompt(
      "77260",
      WHATSAPP_PHONE,
      [],
      "77260"
    )
    return [
      { role: "user", content: "היי" },
      { role: "user", content: "אשמח לברר מה הסטטוס של ההזמנה שלי" },
      {
        role: "assistant",
        content:
          "*הום בוט :)* קודם אמצא את ההזמנה שלכם בזריזות, האם היא רשומה על המספר ממנו אני מתכתב כרגע? (052-6109914) אם לא, אשמח לקבל אותו.",
      },
      { role: "user", content: "לא" },
      {
        role: "assistant",
        content:
          "*הום בוט :)* אין בעיה. אפשר לשלוח לי את מספר הטלפון שעליו נרשמה ההזמנה, או את מספר ההזמנה (למשל #76884).",
      },
      { role: "user", content: "77260" },
      { role: "assistant", content: askPhone },
    ]
  }

  const body = "#77260"

  it("detects alternate-phone pending after order-not-on-phone ask", () => {
    assert.equal(isAlternatePhoneRequestPending(historyThroughPhoneAsk()), true)
  })

  it("resolveOrderShippingReply acknowledges order and re-asks for phone", async () => {
    const reply = await resolveOrderShippingReply({
      body,
      phone: WHATSAPP_PHONE,
      history: historyThroughPhoneAsk(),
    })
    assert.match(reply, /77260/)
    assert.match(reply, /מספר הטלפון/)
    assert.doesNotMatch(reply, /לא זיהיתי מספר טלפון/)
  })

  it("structured pre-turn handles order resend without invalid-phone error", async () => {
    const result = await runStructuredOrderLookupPreTurn({
      turn: { text: body, media: [] },
      history: historyThroughPhoneAsk(),
      phone: WHATSAPP_PHONE,
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.match(result.reply, /77260/)
    assert.doesNotMatch(result.reply, /לא זיהיתי מספר טלפון/)
  })

  it("hints LLM not to treat order resend as invalid phone", () => {
    const hints = buildConversationHints({
      body,
      history: historyThroughPhoneAsk(),
      whatsappPhone: WHATSAPP_PHONE,
    }) ?? ""
    assert.match(hints, /534088322/)
    assert.match(hints, /לא זיהיתי מספר טלפון/)
  })
})
