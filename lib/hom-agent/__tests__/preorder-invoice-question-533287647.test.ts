import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

/**
 * 533287647 — "קיבלתי קבלה על כל הסכום וחשבונית מס רק על המשטח — איפה השטיח?". The carpet was a
 * Pre Order line. Bot replied with delivery status only and ignored the invoice question.
 * Operator policy: answer the document question first; the tax invoice for a preorder item is
 * issued only when it ships, and the receipt covers the full payment.
 */
describe("preorder invoice question 533287647", () => {
  const line = prompt.split("\n").find((l) => l.includes("533287647"))

  it("teaches answering the document question before shipping status", () => {
    assert.ok(line, "missing document-question rule")
    assert.match(line, /Answer the document question first/)
    assert.match(line, /shipping status only if they asked/)
    assert.match(line, /never reply with delivery status alone/)
  })

  it("states the preorder tax-invoice policy", () => {
    assert.ok(line)
    assert.match(line, /חשבונית מס/)
    assert.match(line, /הזמנה מוקדמת/)
    assert.match(line, /only when that item ships/)
    assert.match(line, /קבלה\*\* covers the full payment/)
  })
})
