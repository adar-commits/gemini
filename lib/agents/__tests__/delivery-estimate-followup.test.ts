import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildDeliveryEstimatePolicyReply } from "@/lib/agents/delivery-estimate-policy"
import {
  bindPriorityApiLogContext,
  resetPriorityApiTurnState,
} from "@/lib/agents/priority-webhook"
import type { HistoryMessage } from "@/lib/agents/types"
import {
  isDeliveryEstimateQuestion,
  isOrderStatusDeliveredInThread,
  mapPriorityOrderRow,
  resolveOrderShippingReply,
} from "@/lib/agents/order-lookup"
import {
  clearOrdersLookupCache,
  rememberConversationOrdersLookup,
} from "@/lib/agents/order-lookup-cache"

describe("delivery estimate follow-up after status", () => {
  const statusHistory: HistoryMessage[] = [
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nקודם אמצא את ההזמנה שלכם בזריזות, האם היא רשומה על המספר ממנו אני מתכתב כרגע? (050-6288992)",
    },
    { role: "user", content: "כן זה המספר נייד" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nאוקיי נדמה לי שמצאתי את ההזמנה, בוצעה היום באתר אינטרנט על סך 4,222.75 ש׳׳ח, נכון? (מס׳ הזמנה 76377)",
    },
    { role: "user", content: "כן" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nבדקתי, ההזמנה התקבלה וכעת בתהליכי אריזה במחסני החברה נכון לתאריך 3.9.2026",
    },
  ]

  const estimateQuestion = "מה הצפי ללוח הזמנים שנקבל אותו"

  it("detects delivery estimate wording", () => {
    assert.equal(isDeliveryEstimateQuestion(estimateQuestion), true)
    assert.equal(isOrderStatusDeliveredInThread(statusHistory), true)
  })

  it("does not restart phone lookup after status was already delivered", async () => {
    resetPriorityApiTurnState()
    bindPriorityApiLogContext({
      conversationId: "conv-einat-estimate",
      whatsappPhone: "+972506288992",
    })
    clearOrdersLookupCache()

    const packingOrder = mapPriorityOrderRow({
      ORDNAME: "SO26076377",
      REFERENCE: "76377",
      BRANCHNAME: "3000",
      ORDSTATUSDES: "מאושר לביצוע",
      ZPIT_DELSTATUSCODE: "",
      ZPIT_DELSTATUSDES: "",
      ZPIT_UDATE: "2026-09-03T12:00:00+03:00",
    })
    rememberConversationOrdersLookup(
      "conv-einat-estimate",
      "0506288992",
      [packingOrder]
    )

    const reply = await resolveOrderShippingReply({
      body: estimateQuestion,
      phone: "+972506288992",
      history: statusHistory,
    })

    assert.doesNotMatch(reply, /קודם אמצא את ההזמנה/)
    assert.doesNotMatch(reply, /האם היא רשומה על המספר/)
    assert.match(reply, /4 ימי עסקים/)
    assert.match(reply, /השליח יתאם/)
  })

  it("builds policy reply for packing order without inventing a date", () => {
    const order = mapPriorityOrderRow({
      ORDNAME: "SO26076377",
      ORDSTATUSDES: "מאושר לביצוע",
      ZPIT_DELSTATUSCODE: "",
      ZPIT_DELSTATUSDES: "",
    })
    const reply = buildDeliveryEstimatePolicyReply(order)
    assert.match(reply, /בתהליכי אריזה|מדיניות האספקה/)
    assert.match(reply, /4 ימי עסקים/)
    assert.doesNotMatch(reply, /\d{1,2}\.\d{1,2}\.\d{4}/)
  })

  it("uses coordinate date for status 80 when available", () => {
    const order = mapPriorityOrderRow({
      ORDNAME: "SO26076377",
      ZPIT_DELSTATUSCODE: "80",
      ZPIT_DELSTATUSDES: "מתואם",
      ZPIT_COORDATE: "2026-09-10T10:00:00+03:00",
    })
    const reply = buildDeliveryEstimatePolicyReply(order)
    assert.match(reply, /10\.9\.2026/)
  })

  it("fresh lookup still starts with phone confirm when no prior status", async () => {
    resetPriorityApiTurnState()
    const reply = await resolveOrderShippingReply({
      body: estimateQuestion,
      phone: "+972506288992",
      history: [],
    })
    assert.match(reply, /קודם אמצא את ההזמנה/)
  })
})
