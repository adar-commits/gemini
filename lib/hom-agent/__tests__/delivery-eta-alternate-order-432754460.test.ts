import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  extractOrderReference,
  isKnownOrderConfirmPending,
  isShippingThreadFromHistory,
  orderIdGivenInThread,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const BOT_RECEIPT_ASK =
  "*הום בוט :)*\nשלום טניה! מדובר בהזמנה SO26023519 מהקבלה ששלחנו לך?"

/** 432754460 — delivery ETA → receipt order ask → different order # must lookup, not "no ETA access". */
describe("delivery ETA alternate order id 432754460", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "שלום רב אשמח לדעת צפי הספקה" },
    { role: "assistant", content: BOT_RECEIPT_ASK },
  ]
  const body = "הזמנה 77593"

  it("detects known receipt order pending and alternate customer order id", () => {
    assert.equal(orderIdGivenInThread(history), "SO26023519")
    assert.equal(isKnownOrderConfirmPending(history), true)
    assert.equal(extractOrderReference(body, history), "77593")
    assert.notEqual(
      extractOrderReference(body, history)?.toUpperCase(),
      orderIdGivenInThread(history)?.toUpperCase()
    )
  })

  it("hints lookup_order_status instead of claiming no ETA access", () => {
    const hints = buildConversationHints({ body, history }) ?? ""
    assert.match(hints, /432754460/)
    assert.match(hints, /77593/)
    assert.match(hints, /SO26023519/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /never claim you cannot show delivery ETA/i)
    assert.match(hints, /Never skip lookup and jump to handoff offer/)
  })

  it("does not treat alternate order reply as shipping thread completion", () => {
    assert.equal(isShippingThreadFromHistory(history), false)
  })
})
