import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isKnownOrderConfirmPending,
  isServiceOrderIdentificationFlow,
  orderIdGivenInThread,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const BOT_OFFER =
  "*הום בוט :)*\nשלום שימעון, אין אפשרות להקדים או לתאם מראש מועד משלוח. חברת השליחויות יוצרת קשר ביום האספקה עצמו לפני ההגעה. זמן האספקה לשטיחים הוא עד 4 ימי עסקים מאישור התשלום. אם תרצה, אבדוק באיזה שלב נמצאת ההזמנה SO26024267. זו ההזמנה?"

/** 533760226 — expedite delivery → status-check offer → כן תבדקו must lookup, not service summary. */
describe("expedite delivery status check confirm 533760226", () => {
  const history: HistoryMessage[] = [
    {
      role: "user",
      content: "שלום האים אפשר להקדים את המשלוח של השטיח תודה",
    },
    { role: "assistant", content: BOT_OFFER },
  ]
  const body = "כן תבדקו לי"

  it("recognizes the bot-offered SO as pending known-order confirm", () => {
    assert.equal(orderIdGivenInThread(history), "SO26024267")
    assert.equal(isKnownOrderConfirmPending(history), true)
  })

  it("does not treat expedite/status-check confirm as service order identification", () => {
    assert.equal(isServiceOrderIdentificationFlow(history, body), false)
  })

  it("hints lookup_order_status and blocks service rep summary", () => {
    const hints = buildConversationHints({ body, history }) ?? ""
    assert.match(hints, /533760226/)
    assert.match(hints, /SO26024267/)
    assert.match(hints, /KNOWN ORDER STATUS CHECK YES/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /Never service rep summary/)
    assert.match(hints, /Never human_service/)
    assert.doesNotMatch(hints, /SERVICE ORDER ID/)
  })
})
