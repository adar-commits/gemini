import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import {
  isKnownOrderConfirmPending,
  isOrderConfirmationYes,
  isOrderDeliveryStatusQuestion,
  isShippingThreadFromHistory,
  orderIdGivenInThread,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const ETA_OPENER = "מתי ההזמנה שלי אמורה להגיע? הזמנו לפני החג"
const BOT_CONFIRM =
  "*הום בוט :)*\nהיי עידן, אתה מתכוון להזמנה SO26023067, זו שבקישור המעקב ששלחנו לך?"
const BAD_REPLY =
  "*הום בוט :)*\nבדקתי, ההזמנה התקבלה וכעת בתהליכי אריזה במחסני החברה. שמחתי לעזור!"

/** Replay 533011641 — ETA opener + bare כן must not warm-close after first status lookup. */
describe("ETA opener confirm 533011641", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: ETA_OPENER },
    { role: "assistant", content: BOT_CONFIRM },
  ]
  const body = "כן"

  it("detects shipping thread and known order confirm pending", () => {
    assert.equal(isOrderDeliveryStatusQuestion(ETA_OPENER), true)
    assert.equal(isShippingThreadFromHistory(history), true)
    assert.equal(isKnownOrderConfirmPending(history), true)
    assert.equal(orderIdGivenInThread(history), "SO26023067")
    assert.equal(isOrderConfirmationYes(body), true)
  })

  it("prompt teaches ETA answer after bare confirm — no warm close", () => {
    const line = prompt
      .split("\n")
      .find((l) => l.includes("ETA opener + bare confirm") && l.includes("533011641"))
    assert.ok(line, "missing ETA opener + bare confirm rule")
    assert.match(line!, /action: reply/)
    assert.match(line!, /never.*warm-close/i)
  })

  it("hints lookup + ETA policy — never action end on confirm turn", () => {
    const hints = buildConversationHints({ body, history }) ?? ""
    assert.match(hints, /KNOWN ORDER CONFIRM \+ ETA \(533011641/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /ETA policy/)
    assert.match(hints, /never warm-close/i)
    assert.match(hints, /action reply/)
    assert.doesNotMatch(hints, /then action end/)
  })

  it("bad reply closed with שמחתי לעזור without answering מתי", () => {
    assert.match(BAD_REPLY, /שמחתי לעזור/)
    assert.doesNotMatch(BAD_REPLY, /תאריך|שליח|מועד|מתי/)
  })
})
