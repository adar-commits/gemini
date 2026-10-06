import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

/**
 * 261326074 — "קיבלתי היום קבלה למרות שלא רכשתי כלום היום. מדוע?" Bot explained delayed
 * invoicing but immediately human_service without lookup_order_status.
 */
describe("unexpected receipt timing 261326074", () => {
  const line = prompt.split("\n").find((l) => l.includes("261326074"))

  it("teaches delayed document policy plus lookup without first-turn handoff", () => {
    assert.ok(line, "missing document-question rule for 261326074")
    assert.match(line, /unexpected receipt or invoice today/)
    assert.match(line, /lookup_order_status/)
    assert.match(line, /never.*human_service.*first turn/i)
    assert.match(line, /No handoff needed/)
  })
})
