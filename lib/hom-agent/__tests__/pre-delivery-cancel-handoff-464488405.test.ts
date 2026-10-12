import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

/**
 * 464488405 — "הזמנתי שטיח שטרם הגיע ... רציתי לבטל". Bot answered with the post-receipt return
 * policy + "שמחתי לעזור", then only the portal. Undelivered cancel → human_service, no returns portal.
 */
describe("pre-delivery cancel handoff 464488405", () => {
  const block = prompt.slice(
    prompt.indexOf("Pre-delivery cancel — cancel routing"),
    prompt.indexOf("- **Portal phone prefill")
  )

  it("teaches human_service without returns portal when not received yet", () => {
    assert.match(block, /464488405/)
    assert.match(block, /533685634/)
    assert.match(block, /post-receipt returns only/i)
    assert.match(block, /action: human_service/)
    assert.match(block, /same turn/)
  })

  it("drops the old no-handoff rule and forbids the warm close", () => {
    assert.doesNotMatch(prompt, /No proactive handoff\*\* to "help open cancellation"/)
    assert.match(block, /never warm-close/)
  })
})
