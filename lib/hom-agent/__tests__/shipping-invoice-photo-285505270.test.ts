import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { isOrderNumberRequestPending } from "@/lib/agents/order-lookup"
import { isServiceHandoffSummaryText } from "@/lib/agents/service-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const SHIPPING_OFFER =
  "*הום בוט :)* התשלום יורד פעם אחת בלבד. רוצים שאבדוק את סטטוס המשלוח לפי הטלפון שממנו מתכתבים?"
const ORDER_ASK =
  "*הום בוט :)* בשמחה. כדי לאתר את ההזמנה, יש מספר הזמנה מהקבלה או מהחשבונית שקיבלתם היום? (למשל #36805 או SO26005938) אם אין, אפשר לכתוב את מספר הטלפון שרשום על ההזמנה."
const INVOICE_PHOTO =
  "[תמונה][media:image:https://storage.googleapis.com/media.landbot.io/256062/customers/285445898/6FMG0LR2GROI7P4CJPFO4OBON39R80AE.jpg]"
function historyThroughOrderAsk(): HistoryMessage[] {
  return [
    {
      role: "user",
      content: "\u05E8\u05DB\u05E9\u05EA\u05D9 \u05E9\u05D8\u05D9\u05D7 \u05D122 \u05D1\u05D0\u05D5\u05D2\u05D5\u05E1\u05D8. \u05D4\u05E9\u05D8\u05D9\u05D7 \u05E2\u05D3\u05D9\u05D9\u05DF \u05DC\u05D0 \u05D0\u05E6\u05DC\u05D9",
    },
    { role: "assistant", content: SHIPPING_OFFER },
    { role: "user", content: "\u05D0\u05E9\u05DE\u05D7 \u05EA\u05D5\u05D3\u05D4" },
    { role: "assistant", content: ORDER_ASK },
  ]
}

/** Replay 285505270 — shipping agree + bare invoice photo must lookup, not service summary. */
describe("shipping invoice photo 285505270", () => {
  const history = historyThroughOrderAsk()

  it("detects order ask pending after shipping status offer", () => {
    assert.equal(isOrderNumberRequestPending(history), true)
    assert.match(SHIPPING_OFFER, /\u05E1\u05D8\u05D8\u05D5\u05E1/)
  })

  it("prompt teaches lookup before rep summary on invoice photo", () => {
    const line = prompt.split("\n").find((l) => l.includes("285505270"))
    assert.ok(line, "missing shipping invoice photo rule for 285505270")
    assert.match(line!, /lookup_order_status/)
    assert.match(line!, /Never.*service rep summary/i)
  })

  it("hints lookup on bare invoice photo — not generic PHOTO RECEIVED sales handoff", () => {
    const hints = buildConversationHints({ body: INVOICE_PHOTO, history }) ?? ""
    assert.match(hints, /SHIPPING INVOICE PHOTO \(285505270\)/)
    assert.match(hints, /lookup_order_status/)
    assert.doesNotMatch(hints, /PHOTO RECEIVED \(533695023/)
  })

  it("bad reply skipped lookup and opened service handoff summary", () => {
    const badReply =
      "*הום בוט :)* \u05DE\u05D4\u05D7\u05E9\u05D1\u05D5\u05E0\u05D9\u05EA \u05DC\u05D0 \u05D4\u05E6\u05DC\u05D7\u05EA\u05D9 \u05DC\u05DE\u05E9\u05D5\u05DA \u05DB\u05D0\u05DF \u05D0\u05EA \u05E1\u05D8\u05D8\u05D5\u05E1 \u05D4\u05DE\u05E9\u05DC\u05D5\u05D7, \u05D0\u05D6 \u05D0\u05E2\u05D1\u05D9\u05E8 \u05D0\u05EA \u05D6\u05D4 \u05DC\u05E0\u05E6\u05D9\u05D2 \u05E9\u05D9\u05E8\u05D5\u05EA. \u05D6\u05D4 \u05DE\u05D4 \u05E9\u05D0\u05E2\u05D1\u05D9\u05E8 \u05DC\u05D5: \u2022 IN264021973 \u05D6\u05D4 \u05DE\u05D3\u05D5\u05D9\u05E7, \u05D0\u05D5 \u05E9\u05D7\u05E1\u05E8 \u05DE\u05E9\u05D4\u05D5?"
    assert.equal(isServiceHandoffSummaryText(badReply), true)
    assert.match(badReply, /IN264021973/)
    assert.doesNotMatch(badReply, /\u05DE\u05D5\u05E2\u05D3|\u05DE\u05EA\u05D9.*(?:\u05D9\u05D2\u05D9\u05E2|\u05D4\u05D2\u05E2\u05D4)/)
  })
})
