import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

/**
 * 534138039 — opening: "היי אבקש ליצור. איתי קשר 0505631517".
 * FAQ agent asked order vs purchase; inactivity closed; customer returned for callback.
 */
describe("callback + phone opening 534138039", () => {
  it("prompt teaches immediate human_service, not order vs purchase", () => {
    const line = prompt
      .split("\n")
      .find((l) => l.includes("Callback + phone opening") && l.includes("534138039"))
    assert.ok(line, "missing callback + phone opening rule")
    assert.match(line!, /human_service/)
    assert.match(line!, /Never.*existing order or new purchase/)
    assert.match(line!, /rep will call that number/)
  })
})
