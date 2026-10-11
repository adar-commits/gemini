import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { isExplicitExchangeExecutionTurn } from "@/lib/agents/exchange-intake"
import { classifyPostPurchaseCase } from "@/lib/agents/inquiry-intent"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"

const OPENING = "‏אני רוצה להחליף את השטיח"

const WRONG_SALES_INVENTORY =
  "*הום בוט :)* כדי לבדוק מלאי של Sunny בסניפים, אצטרך את המק״ט (לדוגמה: 31503138-200290)."

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

/** Replay 533511440 event window — exchange opener must not get sales branch-stock SKU ask. */
describe("exchange opening carpet 533511440", () => {
  it("classifies bare replace-the-rug as exchange execution", () => {
    assert.equal(classifyPostPurchaseCase(OPENING), "exchange_request")
    assert.equal(isExplicitExchangeExecutionTurn(OPENING, []), true)
  })

  it("prompt binds opening replace-rug to exchange, not inventory", () => {
    assert.match(prompt, /533511440/)
    assert.match(prompt, /אני רוצה להחליף את השטיח/)
    assert.match(prompt, /never.*lookup_inventory/i)
  })

  it("opening hint forbids sales inventory pivot", () => {
    const hints = buildConversationHints({ body: OPENING, history: [] })
    assert.match(hints ?? "", /EXCHANGE OPENING \(533511440\)/)
    assert.match(hints ?? "", /Never.*lookup_inventory/i)
    assert.match(hints ?? "", /crm_department: service/)
    assert.doesNotMatch(hints ?? "", /ORDER MODIFICATION \(441694412/)
  })

  it("documents the wrong pivot from the incident", () => {
    assert.match(WRONG_SALES_INVENTORY, /Sunny/)
    assert.match(WRONG_SALES_INVENTORY, /מק״ט/)
  })
})
