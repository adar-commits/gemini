import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

/** Facts human reps give customers, confirmed by the operator as policy. */
describe("operator-confirmed rep policy facts", () => {
  it("pouf courier delivery is 100 ₪, also on a combined shipment", () => {
    assert.match(prompt, /פוף[^\n]*\*\*100 ₪\*\*[^\n]*combined into one shipment/)
  })

  it("pouf returns are branch only — never the courier return tiers", () => {
    assert.match(prompt, /never quote the 85–300 ₪ courier return tiers for a pouf/)
    assert.match(prompt, /פוף: סניף בלבד/)
  })

  it("pre-order dates cannot be brought forward", () => {
    assert.match(prompt, /imported from abroad, so the expected date cannot be brought forward/)
  })
})
