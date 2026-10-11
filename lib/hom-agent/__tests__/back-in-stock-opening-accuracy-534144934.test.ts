import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { isBackInStockNotificationRequest } from "@/lib/agents/inventory-lookup"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const OPENING =
  "היי, אשמח לקבל עדכון כשהמידה XXL - 240*340 של שטיח עלמה 02 חום ALMA חוזרת למלאי"

/** Replay 534144934 — step-1 ack must not invent a second product (e.g. רטרו) the customer never named. */
describe("back-in-stock opening accuracy 534144934", () => {
  it("detects restock notification on עלמה 02 opening", () => {
    assert.ok(isBackInStockNotificationRequest(OPENING))
  })

  it("prompt binds step-1 ack to opening product only", () => {
    const line = prompt.split("\n").find((l) => l.includes("Back-in-stock notification"))
    assert.ok(line)
    assert.match(line!, /534144934/)
    assert.match(line!, /never.*add another model/i)
  })

  it("opening turn hint forbids extra models not in the customer message", () => {
    const hints = buildConversationHints({ body: OPENING, history: [] })
    assert.match(hints ?? "", /534144934/)
    assert.match(hints ?? "", /never.*add another model/i)
    assert.match(hints ?? "", /do not mention רטרו when they only said עלמה 02/i)
    assert.match(hints ?? "", /action reply/i)
  })
})
