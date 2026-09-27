import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

function ruleLine(marker: string): string {
  const line = prompt.split("\n").find((l) => l.includes(marker) && l.includes("314443580"))
  assert.ok(line, `missing prompt rule: ${marker}`)
  return line
}

/**
 * 314443580 — customer asked about החלפה days earlier, returned with "לא קיבלתי את השטיח".
 * Bot recapped the old exchange intent, then after "לא מדויק בכלל" handed off repeating "השינוי בהזמנה".
 */
describe("latest request over history 314443580", () => {
  it("teaches that a new unrelated request is answered, not the old exchange topic", () => {
    const line = ruleLine("Latest request outranks old history")
    assert.match(line, /לא קיבלתי את השטיח/)
    assert.match(line, /lookup_order_status/)
    assert.match(line, /Never\*\* carry an old intent/)
  })

  it("teaches a clarifying question after a rejected summary, without repeating it", () => {
    const line = ruleLine("Summary rejected")
    assert.match(line, /לא מדויק/)
    assert.match(line, /שנציג יחזור אליי/)
    assert.match(line, /action: "reply"/)
    assert.match(line, /do not repeat/)
    assert.match(line, /human_service/)
  })
})
