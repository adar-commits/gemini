import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import { isCheckoutPriceDiscrepancyThread } from "@/lib/agents/product-handoff"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"

/**
 * 534083437 — customer asked "למה המחיר משתנה בקופה?" with two screenshots on the
 * first turn. FAQ agent ignored the images and asked for a screenshot again.
 */
describe("checkout price photo 534083437", () => {
  const history: HistoryMessage[] = []
  const body =
    "למה המחיר משתנה בקופה ? [תמונה: למה המחיר משתנה בקופה ?][media:image:https://storage.googleapis.com/media.landbot.io/256062/customers/533832599/VMGLBTOK1X6CFRPKJTXWBSMQ8N1O1JD5.jpg] [תמונה][media:image:https://storage.googleapis.com/media.landbot.io/256062/customers/533832599/BGWR0YAO91Y2UN3P2OJ3M6WJ6DZH4U1V.jpg]"

  it("detects checkout price discrepancy in thread", () => {
    assert.equal(isCheckoutPriceDiscrepancyThread(history, body), true)
  })

  it("hints acknowledge photos and human_sales without re-asking screenshot", () => {
    const hints = buildConversationHints({
      history,
      body,
      whatsappPhone: "+972500000000",
    })
    assert.notEqual(hints, null)
    assert.match(hints!, /CHECKOUT PRICE PHOTO \(534083437\)/)
    assert.match(hints!, /already arrived/)
    assert.match(hints!, /Never.*ask to send a screenshot again/i)
    assert.match(hints!, /action: human_sales/)
    assert.doesNotMatch(hints!, /INVENTORY SKU PHOTO/)
  })

  it("prompt teaches checkout price + screenshot handoff", () => {
    const prompt = readFileSync(
      join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"),
      "utf8"
    )
    const line = prompt
      .split("\n")
      .find((l) => l.includes("Checkout price discrepancy") && l.includes("534083437"))
    assert.ok(line)
    assert.match(line!, /קיבלתי את צילומי המסך/)
    assert.match(line!, /action: human_sales/)
    assert.match(line!, /Never.*ask them to send a screenshot/)
  })
})
