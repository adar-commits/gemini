import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isActiveDigitalDocumentFlow,
  isDirectReceiptPhoneIntakeThread,
  shouldDeferDocumentFlowToOrderLookup,
} from "@/lib/agents/digital-document-flow"
import { buildNoOrdersFoundReply } from "@/lib/agents/order-lookup"
import { executeLookupOrderStatus } from "@/lib/hom-agent/tools/order-status"
import {
  runStructuredDocumentPreTurn,
  runStructuredOrderLookupPreTurn,
} from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

const WHATSAPP = "+972528319265"
const TYPED_PHONE = "0585505353"

function history533106217(): HistoryMessage[] {
  return [
    { role: "user", content: "אז מה הצפי הגעה" },
    { role: "user", content: "ובנוסף לא קבלתי חשבונית למייל" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* הפריט בהזמנה (פנסי בז 230*160) הוא בהזמנה מוקדמת, ולכן אין עדיין תאריך הגעה מדויק. חידוש המלאי צפוי בסביבות 29/10/2026. לגבי החשבונית: את הקבלה מקבלים על התשלום המלא כבר בזמן הרכישה. חשבונית מס על פריט בהזמנה מוקדמת יוצאת רק כשהוא נשלח. צריכים עותק של הקבלה? אפשר לשלוח אותו לכאן",
    },
    { role: "user", content: "כן אשמח" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nהאם העסקה רשומה על המספר ממנו אני מתכתב כרגע? (052-8319265)\nאם לא, אשמח לקבל את המספר הנכון.",
    },
  ]
}

/** 533106217 — ETA thread, receipt copy accepted, alternate phone must use getDocument not order lookup. */
describe("receipt copy shipping phone 533106217", () => {
  it("detects direct receipt phone intake without type menu", () => {
    const history = history533106217()
    assert.equal(isDirectReceiptPhoneIntakeThread(history), true)
  })

  it("does not defer document flow to order lookup on typed phone", () => {
    const history = history533106217()
    assert.equal(shouldDeferDocumentFlowToOrderLookup(history, TYPED_PHONE), false)
    assert.equal(isActiveDigitalDocumentFlow(history, TYPED_PHONE), true)
  })

  it("document pre-turn handles alternate phone — never order-not-found handoff", async () => {
    const result = await runStructuredDocumentPreTurn({
      turn: { text: TYPED_PHONE, media: [] },
      history: history533106217(),
      phone: WHATSAPP,
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.doesNotMatch(result.reply, /לא מצאתי הזמנות פעילות/)
    assert.doesNotMatch(result.reply, /האם להעביר את השיחה לנציג/)
    assert.notEqual(result.reply.trim(), buildNoOrdersFoundReply(TYPED_PHONE).trim())
    assert.match(
      result.reply,
      /מסמך|קבלה|קישור|להעביר\s+לנציג|תקלה\s+זמנית/i
    )
  })

  it("order pre-turn skips and lookup tool refuses during document flow", async () => {
    const history = history533106217()
    const order = await runStructuredOrderLookupPreTurn({
      turn: { text: TYPED_PHONE, media: [] },
      history,
      phone: WHATSAPP,
    })
    assert.equal(order.kind, "skip")

    const tool = await executeLookupOrderStatus({
      body: TYPED_PHONE,
      phone: WHATSAPP,
      history,
    })
    assert.equal(tool.ok, false)
    if (tool.ok) return
    assert.match((tool as { error: string }).error, /fetch_digital_document/)
  })
})
