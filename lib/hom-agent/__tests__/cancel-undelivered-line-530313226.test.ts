import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { isOrderCancellationSummaryLabel } from "@/lib/agents/service-intake"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

/**
 * 530313226 — opening: cancel LOOPS rug not yet supplied; bot wrongly opened with "משלוח נמסר".
 */
describe("cancel undelivered line 530313226", () => {
  const opening =
    "היי, מה שלומכם? אני רוצה לבטל הזמנה של שטיח לולאות שעדיין לא סופק לי (הזמנתי כבר לפני למעלה מחודש ואין במלאי)"
  const history: HistoryMessage[] = []

  it("detects pre-delivery cancel on undelivered line wording", () => {
    assert.equal(isOrderCancellationSummaryLabel(opening), true)
  })

  it("prompt teaches cancel undelivered line without order-level delivered lead", () => {
    const line = prompt
      .split("\n")
      .find((l) => l.includes("Cancel undelivered line / mixed order") && l.includes("530313226"))
    assert.ok(line, "missing cancel undelivered line rule")
    assert.match(line!, /464488405/)
    assert.match(line!, /Never.*משלוח נמסר/)
    assert.match(line!, /human_service/)
  })

  it("hints pre-delivery cancel execution on opening turn", () => {
    const hints = buildConversationHints({
      history,
      body: opening,
      whatsappPhone: "0548183943",
    })
    assert.notEqual(hints, null)
    assert.match(hints!, /PRE-DELIVERY CANCEL OPENING \(348040437/)
    assert.match(hints!, /530313226/)
    assert.match(hints!, /action human_service/)
    assert.match(hints!, /Never open with order-level משלוח נמסר/)
    assert.match(hints!, /Never lookup_order_status only/)
  })

  it("correction turn after wrong delivered status is not a fresh cancel opening", () => {
    const afterWrongStatus: HistoryMessage[] = [
      { role: "user", content: opening },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nבדקתי, המשלוח סומן כנמסר באמצעות שליח…",
      },
    ]
    const hints = buildConversationHints({
      history: afterWrongStatus,
      body: "יש לכם טעות",
      whatsappPhone: "0548183943",
    })
    assert.doesNotMatch(hints ?? "", /PRE-DELIVERY CANCEL OPENING \(348040437/)
  })
})
