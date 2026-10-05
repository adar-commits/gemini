import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import {
  isKnownOrderConfirmPending,
  isNonReceiptShippingOpenerFromHistory,
  isOrderConfirmationYes,
  isShippingThreadFromHistory,
  orderIdGivenInThread,
} from "@/lib/agents/order-lookup"
import { isShippingStatusQuestion } from "@/lib/agents/shipping"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const OPENING = "אני עדיין לא קיבלתי את השטיחים שהזמנתי ממכם"
const BOT_CONFIRM =
  "*הום בוט :)*\nהיי זיו, מצטער שהשטיחים עדיין לא הגיעו. מדובר בהזמנה SO26022389 מקישור המעקב שנשלח אליכם?"
const BAD_REPLY =
  "*הום בוט :)*\nבדקתי, המשלוח סומן כנמסר…\n\nאם יש משהו נוסף שאוכל לעזור בו, אני כאן 😊"

/** Replay 532314606 — non-receipt opener + bare כן must not action end when status is delivered. */
describe("non-receipt delivered status 532314606", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: OPENING },
    { role: "assistant", content: BOT_CONFIRM },
  ]
  const body = "כן"

  it("detects non-receipt shipping opener and order confirm pending", () => {
    assert.equal(isShippingStatusQuestion(OPENING), true)
    assert.equal(isNonReceiptShippingOpenerFromHistory(history), true)
    assert.equal(isShippingThreadFromHistory(history), true)
    assert.equal(isKnownOrderConfirmPending(history), true)
    assert.equal(orderIdGivenInThread(history), "SO26022389")
    assert.equal(isOrderConfirmationYes(body), true)
  })

  it("prompt teaches delivered + non-receipt gap — no action end on confirm", () => {
    const line = prompt
      .split("\n")
      .find((l) => l.includes("Non-receipt opener + order confirm") && l.includes("532314606"))
    assert.ok(line, "missing non-receipt opener + order confirm rule")
    assert.match(line!, /action: reply/)
    assert.match(line!, /never.*action: end/i)
    assert.match(line!, /delivered/i)
  })

  it("hints lookup + gap acknowledgment — never action end on confirm turn", () => {
    const hints = buildConversationHints({ body, history }) ?? ""
    assert.match(hints, /NON-RECEIPT ORDER CONFIRM YES \(532314606/)
    assert.match(hints, /KNOWN ORDER CONFIRM \+ NON-RECEIPT \(532314606/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /never.*action end/i)
    assert.match(hints, /delivered/i)
  })

  it("bad reply closed with warm offer instead of addressing non-receipt claim", () => {
    assert.match(BAD_REPLY, /סומן כנמסר/)
    assert.match(BAD_REPLY, /אם יש משהו נוסף/)
    assert.doesNotMatch(BAD_REPLY, /איזה|מה הגיע|חסר|חוץ/)
  })
})
