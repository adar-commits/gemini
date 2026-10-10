import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isOrderNumberRequestPending,
  resolveOrderShippingReply,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { shouldDeferStructuredPreTurnToLlm } from "@/lib/hom-agent/opening-turn-llm"
import { runStructuredOrderLookupPreTurn } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

const WHATSAPP_PHONE = "+972526109914"

/** 534088322 — phone empty, bot asked order #, customer sent #77260; must lookup not re-phone-fail handoff. */
describe("order id after phone miss ask 534088322", () => {
  const historyBeforeOrderId = (): HistoryMessage[] => [
    { role: "user", content: "היי" },
    { role: "user", content: "עדיין לא הגיעה ההזמנה" },
    { role: "user", content: "כבר עברו מעבר ל4 ימים" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* לא מצאתי הזמנות לפי הטלפון (052-6109914). אשמח למספר ההזמנה (למשל SO26005938 או #76884).",
    },
  ]

  const body = "#77260"

  it("detects order-number ask pending", () => {
    assert.equal(isOrderNumberRequestPending(historyBeforeOrderId()), true)
  })

  it("does not defer structured order lookup to LLM after order-number ask", () => {
    assert.equal(
      shouldDeferStructuredPreTurnToLlm(historyBeforeOrderId(), {
        text: body,
        media: [],
      }),
      false
    )
  })

  it("structured pre-turn handles order id — not phone-miss handoff loop", async () => {
    const result = await runStructuredOrderLookupPreTurn({
      turn: { text: body, media: [] },
      history: historyBeforeOrderId(),
      phone: WHATSAPP_PHONE,
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.match(result.reply, /77260/)
    assert.doesNotMatch(result.reply, /לא מצאתי הזמנות פעילות לפי הטלפון.*נציג/)
  })

  it("resolveOrderShippingReply looks up by order reference", async () => {
    const reply = await resolveOrderShippingReply({
      body,
      phone: WHATSAPP_PHONE,
      history: historyBeforeOrderId(),
    })
    assert.match(reply, /77260/)
    assert.doesNotMatch(reply, /לא מצאתי הזמנות פעילות לפי הטלפון.*נציג/)
  })

  it("hints bind lookup_order_status on order id answer", () => {
    const hints = buildConversationHints({
      body,
      history: historyBeforeOrderId(),
      whatsappPhone: WHATSAPP_PHONE,
    }) ?? ""
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /77260|534088322/)
  })
})
