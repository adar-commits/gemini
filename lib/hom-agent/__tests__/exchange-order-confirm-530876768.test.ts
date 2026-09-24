import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildDissatisfactionRescueReply } from "@/lib/agents/dissatisfaction"
import {
  buildExchangeIntakeStartReply,
  isExchangeIntakeActive,
  needsExchangeKindQuestion,
} from "@/lib/agents/exchange-intake"
import { isServiceOrderIdentificationFlow } from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const PHONE = "+97250876768"

function historyThroughOrderCardConfirm(): HistoryMessage[] {
  return [
    { role: "assistant", content: buildDissatisfactionRescueReply(PHONE) },
    { role: "user", content: "החלפה" },
    { role: "assistant", content: buildExchangeIntakeStartReply() },
    { role: "user", content: "0508767680" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nנדמה לי שמצאתי את ההזמנה SO260876768 (מס׳ הזמנה #876768) — זו ההזמנה?",
    },
  ]
}

/** Replay 530876768 — exchange order-card כן must not trigger service summary. */
describe("exchange order confirm (530876768)", () => {
  it("exchange intake stays active through order card confirm", () => {
    const history = historyThroughOrderCardConfirm()
    assert.equal(isExchangeIntakeActive(history), true)
    assert.equal(isServiceOrderIdentificationFlow(history, "כן"), true)
  })

  it("hints exchange kind question on order-card confirm — not service summary or re-lookup", () => {
    const history = historyThroughOrderCardConfirm()
    const hints = buildConversationHints({
      body: "כן",
      history,
      phone: PHONE,
    })

    assert.match(hints ?? "", /EXCHANGE ORDER CONFIRM YES \(530876768\)/i)
    assert.match(hints ?? "", /A\/B\/C exchange-kind question/i)
    assert.match(hints ?? "", /create_switch_request → human_sales/i)
    assert.doesNotMatch(hints ?? "", /SERVICE ORDER ID/i)
    assert.doesNotMatch(hints ?? "", /ORDER CONFIRM YES:.*call lookup_order_status immediately/i)
    assert.doesNotMatch(hints ?? "", /SERVICE THREAD \(שירות לקוחות\)/i)
  })

  it("needs exchange kind question after order is confirmed in thread", () => {
    const history: HistoryMessage[] = [
      ...historyThroughOrderCardConfirm(),
      { role: "user", content: "כן" },
      {
        role: "assistant",
        content: "בדקתי, לגבי הזמנה SO260876768 הסטטוס הוא נמסר.",
      },
    ]
    assert.equal(needsExchangeKindQuestion(history), true)
    const hints = buildConversationHints({ body: "", history, phone: PHONE })
    assert.match(hints ?? "", /EXCHANGE KIND PENDING/i)
    assert.doesNotMatch(hints ?? "", /SERVICE ORDER ID/i)
  })
})
