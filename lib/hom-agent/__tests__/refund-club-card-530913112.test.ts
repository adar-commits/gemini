import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

/**
 * 530913112 — customer paid with a כרטיס מועדון חבר and asked "הכסף חוזר לשם?".
 * Bot said "אין לי כאן פירוט" / "אני לא יכול לאשר" and sent human_service.
 * Operator policy: the refund always returns to the original payment method, club card included.
 */
describe("refund to club card 530913112", () => {
  const line = prompt.split("\n").find((l) => l.includes("Refund payment method") && l.includes("530913112"))

  it("teaches that the refund returns to the original payment method, club card included", () => {
    assert.ok(line, "missing prompt rule: Refund payment method")
    assert.match(line, /original payment method/)
    assert.match(line, /כרטיס מועדון חבר/)
  })

  it("answers with reply instead of handing off or saying there is no info", () => {
    assert.ok(line)
    assert.match(line, /`action: reply`/)
    assert.match(line, /\*\*never `human_service`\*\*/)
    assert.match(line, /אין לי כאן פירוט/)
  })
})
