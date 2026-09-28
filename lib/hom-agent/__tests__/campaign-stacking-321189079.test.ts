import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

function ruleLine(marker: string, sessionId: string): string {
  const line = prompt.split("\n").find((l) => l.includes(marker) && l.includes(sessionId))
  assert.ok(line, `missing prompt rule: ${marker}`)
  return line
}

/**
 * 321189079 — after "הכל ב-50% בתוקף עד 04/10", customer asked "תקף גם בסניפים?" and
 * "האם יש כפל מבצעים?". Bot sent "לא הצלחתי להבין אתכם נכון" and handed off to sales.
 * Operator policy: valid in branches and no stacking, unless the terms page says otherwise.
 */
describe("campaign stacking follow-up 321189079", () => {
  it("teaches that promotions do not stack unless the terms page says otherwise", () => {
    const line = ruleLine("כפל מבצעים", "321189079")
    assert.match(line, /do not stack/)
    assert.match(line, /תקנון המבצע/)
    assert.match(line, /\*\*never\*\* "לא הצלחתי להבין"/)
  })

  it("keeps the branch validity rule for the same follow-up thread", () => {
    const line = ruleLine("Campaign valid in stores", "307194147")
    assert.match(line, /valid in the branches too/)
    assert.match(line, /תקנון המבצע/)
  })
})
