import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildOrderStatusClarificationReply,
  resolveOrderStatusFollowUpReply,
  type OrderShipmentStatus,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { validateHomAgentReply } from "@/lib/hom-agent/validate-reply"
import type { HistoryMessage } from "@/lib/agents/types"

/** 531893004 — status already answered; do not offer a rep. */
describe("status answer without handoff 531893004", () => {
  const statusLine =
    "איזה כיף! המשלוח הועמס לשליח ובדרכו אליך ברגעים אלה."
  const history: HistoryMessage[] = [
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nאוקיי נדמה לי שמצאתי את ההזמנה, בוצעה לפני 7 ימים באתר אינטרנט על סך 345 ש׳׳ח נכון? (מס׳ הזמנה ⁦#76679⁩)",
    },
    { role: "user", content: "כן" },
    {
      role: "assistant",
      content: `*הום בוט :)*\nבדקתי, ${statusLine} נכון לתאריך 17/09/2026 בשעה 13:04\n\nשמחתי לעזור!`,
    },
  ]
  const body = "למה לא קיבלתי המשלוח?"

  const order = {
    orderNumber: "76679",
    statusCode: "5",
    statusLabel: "הועמס",
    branchLabel: "אתר אינטרנט",
    branchCode: null,
    totalPrice: 345,
    statusDescription: statusLine,
    raw: {},
  } as OrderShipmentStatus

  it("explains in-transit status and does not offer a representative", () => {
    const reply = buildOrderStatusClarificationReply(history)
    assert.match(reply, /בקצרה — המשלוח כבר יצא מהמחסן ונמצא בדרך/)
    assert.match(reply, /השליח יתאם איתכם טלפונית ביום האספקה/)
    assert.match(reply, /שמחתי לעזור/)
    assert.doesNotMatch(reply, /האם להעביר/)
    assert.doesNotMatch(reply, /נציג/)
  })

  it("follow-up on the same status stays a reply, not a handoff", () => {
    const reply = resolveOrderStatusFollowUpReply(order, body, history)
    assert.match(reply, /בדרך/)
    assert.doesNotMatch(reply, /האם להעביר/)
  })

  it("repeating that answer does not become a human offer", () => {
    const reply = buildOrderStatusClarificationReply(history)
    const result = validateHomAgentReply(
      { reply, action: "reply" },
      "למה עדין לא קיבלתי ההזמנה?",
      "+972526347116",
      [{ role: "assistant", content: reply }]
    )
    assert.equal(result.action, "reply")
    assert.match(result.reply, /בדרך/)
    assert.doesNotMatch(result.reply, /האם להעביר/)
    assert.doesNotMatch(result.reply, /לא הצלחתי להבין/)
  })

  it("still hands off when the system says delivered and they dispute it", () => {
    const delivered: HistoryMessage[] = [
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nבדקתי, המשלוח נמסר באמצעות שליח. נכון לתאריך 17/09/2026",
      },
    ]
    const reply = buildOrderStatusClarificationReply(delivered)
    assert.match(reply, /האם להעביר לנציג שירות/)
  })

  it("hints that a complete status answer is not a handoff", () => {
    const hints = buildConversationHints({ body, history })
    assert.match(hints ?? "", /531893004/)
    assert.match(hints ?? "", /never append האם להעביר/)
  })
})
