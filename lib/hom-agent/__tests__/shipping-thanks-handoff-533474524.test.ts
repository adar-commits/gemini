import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import {
  isOrderLookupCompletedInThread,
  isShippingThreadFromHistory,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runPreTurnGuards } from "@/lib/hom-agent/pre-turn"

const STATUS_REPLY =
  "*הום בוט :)*\nהיי בוקר טוב, מתנצלת על העיכוב🙏 לפי המערכת המשלוח על שליח וצפוי להגיע היום במקביל מנסה לוודא את זה מול חברת השליחויות, עדכני בבקשה אם מגיע או לא מגיע במהלך היום"

function historyAfterStatusUpdate(): HistoryMessage[] {
  return [
    {
      role: "user",
      content: "בוקר אור אשמח לדעת מתי אני מקבלת את ההזמנה?",
    },
    { role: "assistant", content: STATUS_REPLY },
  ]
}

function historyWithLookupCard(): HistoryMessage[] {
  return [
    {
      role: "user",
      content: "בוקר אור אשמח לדעת מתי אני מקבלת את ההזמנה?",
    },
    { role: "user", content: "SO26024000" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nבדקתי, המשלוח על שליח וצפוי להגיע היום. עדכני אם מגיע במהלך היום.",
    },
  ]
}

/** Replay 533474524 — thanks after shipping status must warm-close, not hand off. */
describe("shipping thanks handoff (533474524)", () => {
  it("recognizes shipping thread from delivery timing ask", () => {
    assert.equal(isShippingThreadFromHistory(historyAfterStatusUpdate()), true)
  })

  it("pre-turn warm-closes on thanks after informal status update", () => {
    const result = runPreTurnGuards({
      turn: { text: "תודה רבה🙏", media: [] },
      history: historyAfterStatusUpdate(),
      customerName: "ניצה",
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "end")
    assert.match(result.reply, /שמחתי לעזור/)
    assert.doesNotMatch(result.reply, /העברתי/)
    assert.doesNotMatch(result.reply, /נציג/)
  })

  it("pre-turn warm-closes on thanks even after lookup status card on shipping thread", () => {
    assert.equal(isOrderLookupCompletedInThread(historyWithLookupCard()), true)
    assert.equal(isShippingThreadFromHistory(historyWithLookupCard()), true)

    const result = runPreTurnGuards({
      turn: { text: "תודה רבה", media: [] },
      history: historyWithLookupCard(),
      customerName: "ניצה",
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "end")
    assert.doesNotMatch(result.reply, /העברתי/)
  })

  it("hints warm close on shipping thanks — never human_service", () => {
    const hints = buildConversationHints({
      body: "תודה רבה🙏",
      history: historyAfterStatusUpdate(),
      whatsappPhone: "0501234567",
      customerName: "ניצה",
    })
    assert.match(hints ?? "", /533474524/)
    assert.match(hints ?? "", /action end/i)
    assert.match(hints ?? "", /Never human_service/i)
  })
})
