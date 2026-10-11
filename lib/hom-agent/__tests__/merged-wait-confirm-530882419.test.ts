import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isOrderConfirmationYes } from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const BAD_HANDOFF =
  "כרגע אני לא יכול להציג כאן את סטטוס המשלוח של הזמנה #76273"

/** Replay 530882419 — merged «מעל חודש» + «כן» after order card must lookup, not human_service. */
describe("merged wait confirm shipping lookup 530882419", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "היי, מה קורה עם ההזמנה שלי?" },
    { role: "assistant", content: "*הום בוט :)* אני על זה, כמה רגעים בבקשה 🙏" },
    { role: "user", content: "זה כבר מעל חודש" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* מצאתי הזמנה שבוצעה לפני 41 ימים באתר אינטרנט, על סך 295 ש״ח. זו ההזמנה? (מס׳ הזמנה ⁦#76273⁩)",
    },
  ]
  const body = "זה כבר מעל חודש\nכן"

  it("treats trailing כן on merged rapid messages as order confirm", () => {
    assert.equal(isOrderConfirmationYes(body), true)
  })

  it("hints lookup on shipping thread — not skip-to-handoff", () => {
    const hints = buildConversationHints({ body, history }) ?? ""
    assert.match(hints, /ORDER CONFIRM YES/)
    assert.match(hints, /lookup_order_status/)
    assert.doesNotMatch(hints, /לא ניתן להציג סטטוס/)
  })

  it("bad reply skips lookup and handoffs", () => {
    assert.match(BAD_HANDOFF, /לא יכול להציג/)
    assert.match(BAD_HANDOFF, /76273/)
  })
})
