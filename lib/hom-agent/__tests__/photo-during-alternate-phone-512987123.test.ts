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

const WHATSAPP_PHONE = "+972509404412"

/** 512987123 — defect photo sent while bot asked for order phone after IN miss. */
describe("photo during alternate phone ask 512987123", () => {
  const historyThroughPhoneAsk = (): HistoryMessage[] => {
    const askPhone = buildOrderNotOnPhoneAskOrderPhonePrompt(
      "IN264021543",
      WHATSAPP_PHONE,
      [],
      "IN264021543"
    )
    return [
      { role: "user", content: "קיבלתי היום את הפוף ויש בו חלק מלוכלך ומשופשף" },
      {
        role: "assistant",
        content:
          "*הום בוט :)* מצטער — אפשר תמונה ברורה של האזור? ואם יש מספר הזמנה, אשמח לקבל.",
      },
      { role: "user", content: "יש לי מס חשבונית IN264021543" },
      { role: "assistant", content: askPhone },
    ]
  }

  const body =
    "[תמונה][media:image:https://storage.googleapis.com/media.landbot.io/256062/customers/512764338/KK3Q7XUK35IVYW4XZYIWWGSNVYY50GJ1.jpg]"

  it("detects alternate-phone pending after order-not-on-phone ask", () => {
    assert.equal(isAlternatePhoneRequestPending(historyThroughPhoneAsk()), true)
  })

  it("resolveOrderShippingReply acknowledges photo and re-asks for phone", async () => {
    const reply = await resolveOrderShippingReply({
      body,
      phone: WHATSAPP_PHONE,
      history: historyThroughPhoneAsk(),
    })
    assert.match(reply, /קיבלתי את התמונה/)
    assert.match(reply, /מספר הטלפון/)
    assert.doesNotMatch(reply, /לא זיהיתי מספר טלפון/)
  })

  it("structured pre-turn handles photo without invalid-phone error", async () => {
    const result = await runStructuredOrderLookupPreTurn({
      turn: { text: body, media: [] },
      history: historyThroughPhoneAsk(),
      phone: WHATSAPP_PHONE,
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.match(result.reply, /קיבלתי את התמונה/)
    assert.doesNotMatch(result.reply, /לא זיהיתי מספר טלפון/)
  })

  it("hints LLM not to treat defect photo as invalid phone", () => {
    const hints = buildConversationHints({
      body,
      history: historyThroughPhoneAsk(),
      whatsappPhone: WHATSAPP_PHONE,
    }) ?? ""
    assert.match(hints, /512987123/)
    assert.match(hints, /לא זיהיתי מספר טלפון/)
  })
})
