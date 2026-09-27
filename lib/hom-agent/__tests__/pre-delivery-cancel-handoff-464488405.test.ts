import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

/**
 * 464488405 — "הזמנתי שטיח שטרם הגיע ... רציתי לבטל". Bot answered with the post-receipt return
 * policy + "שמחתי לעזור", then only the portal. Operator policy: portal link AND human_service.
 */
describe("pre-delivery cancel handoff 464488405", () => {
  const line = prompt.split("\n").find((l) => l.includes("Pre-delivery cancel") && l.includes("464488405"))

  it("teaches portal + human_service in the same turn", () => {
    assert.ok(line, "missing pre-delivery cancel rule")
    assert.match(line, /returns portal/)
    assert.match(line, /action: human_service/)
    assert.match(line, /same turn/)
  })

  it("drops the old no-handoff rule and forbids the warm close", () => {
    assert.ok(line)
    assert.doesNotMatch(prompt, /No proactive handoff\*\* to "help open cancellation"/)
    assert.match(line, /never warm-close/)
  })
})
