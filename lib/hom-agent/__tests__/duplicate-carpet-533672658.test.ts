import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  classifyPostPurchaseCase,
  isDuplicateOrExtraItemComplaint,
} from "@/lib/agents/inquiry-intent"
import { isServiceLookupContext } from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const OPENING = "הגיע אלי שטיח נוסף שלא הזמנתי"
const FOLLOWUP = "הגיע אותו שטיח פעמיים"

function historyThroughBotQuestion(): HistoryMessage[] {
  return [
    { role: "user", content: "שלום" },
    { role: "user", content: OPENING },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nשלום עדי, תודה שעדכנת אותנו. השטיח הנוסף הגיע יחד עם ההזמנה SO26024139 (זו מהקבלה ששלחנו)?",
    },
  ]
}

function historyThroughWrongShippingReply(): HistoryMessage[] {
  return [
    ...historyThroughBotQuestion(),
    {
      role: "user",
      content:
        "בנוסף אשמח לרכוש שטיח נוסף אך צריכה המלצה לשטיח עבה לסלון. יש ילדים קטנים\nהגיע אותו שטיח פעמיים",
    },
  ]
}

/** Replay 533672658 — duplicate/extra item must stay service, not shipping status. */
describe("duplicate extra carpet (533672658)", () => {
  it("classifies extra/duplicate delivery as a service case", () => {
    assert.equal(isDuplicateOrExtraItemComplaint(OPENING), true)
    assert.equal(isDuplicateOrExtraItemComplaint(FOLLOWUP), true)
    assert.equal(classifyPostPurchaseCase(OPENING), "missing_item")
    assert.equal(classifyPostPurchaseCase(FOLLOWUP), "missing_item")
  })

  it("treats bot extra-item question as service lookup context", () => {
    const history = historyThroughBotQuestion()
    assert.equal(isServiceLookupContext(history), true)
  })

  it("emits duplicate/extra hint forbidding shipping status on the combined turn", () => {
    const hints = buildConversationHints({
      body: historyThroughWrongShippingReply().at(-1)!.content,
      history: historyThroughWrongShippingReply().slice(0, -1),
      whatsappPhone: "0529999966",
    })
    assert.match(hints, /DUPLICATE \/ EXTRA ITEM \(533672658\)/)
    assert.match(hints, /Never.*delivery status/)
    assert.doesNotMatch(hints, /ORDER STATUS OPENING/)
  })

  it("keeps service lookup context on the combined duplicate + sales turn", () => {
    const history = historyThroughWrongShippingReply().slice(0, -1)
    const body = historyThroughWrongShippingReply().at(-1)!.content
    assert.equal(isServiceLookupContext(history), true)
    assert.equal(classifyPostPurchaseCase(body), "missing_item")
  })

  it("gift follow-up after extra-rug pickup reply binds human_service not human_sales", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "לא חזרו אלי" },
      { role: "user", content: "אני אשמח לדבר עם מישהו טלפונית" },
      { role: "user", content: "מה קורה?" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nסליחה על ההמתנה, עדי. הצוות ימשיך איתך ביום ראשון לגבי האיסוף של השטיח הנוסף ולגבי ההמלצה לשטיח עבה לסלון.",
      },
      { role: "user", content: "אני מבינה שהשטיח נשאר אצלי כמתנה?" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nלא, את זה אני לא יכול לאשר. השטיח הנוסף לא נשאר אצלך כמתנה. צוות השירות ימשיך איתך ביום ראשון לגבי השטיח הנוסף ותיאום האיסוף.",
      },
    ]
    const body = "אני מבינה שהשטיח נשאר אצלי כמתנה?"
    const hints = buildConversationHints({ history, body }) ?? ""
    assert.match(hints, /EXTRA RUG PICKUP \/ GIFT \(533672658\)/)
    assert.match(hints, /human_service/)
    assert.match(hints, /never.*human_sales/i)
  })
})
