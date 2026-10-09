import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import {
  isBackInStockNotificationRequest,
  isInventoryQuestion,
  shouldHandleBranchInventory,
} from "@/lib/agents/inventory-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runStructuredInventoryPreTurn } from "@/lib/hom-agent/pre-turn"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const OPENING =
  "היי, אשמח לקבל עדכון כשהמידה L - 160*230 של שטיח פרל קרם PEARL חוזרת למלאי"

const WRONG_REPLY =
  "מכאן אני לא יכול לרשום אותך לעדכון על חזרה למלאי. כן אפשר לבדוק עכשיו אם יש פרל קרם במידה 160*230 באחод הסניפים או במחסן. אם תשלח לי את המק״ט"

/** 534030320 — restock alert ask must human_sales, not FAQ SKU inventory pivot. */
describe("back-in-stock notification opening 534030320", () => {
  it("prompt teaches immediate human_sales, not SKU lookup", () => {
    const line = prompt
      .split("\n")
      .find((l) => l.includes("Back-in-stock notification") && l.includes("534030320"))
    assert.ok(line, "missing back-in-stock notification rule")
    assert.match(line!, /human_sales/)
    assert.match(line!, /Never.*lookup_inventory/)
  })

  it("defers inventory structured path for notification wording", () => {
    assert.equal(isBackInStockNotificationRequest(OPENING), true)
    assert.equal(isInventoryQuestion(OPENING), false)
    assert.equal(shouldHandleBranchInventory(OPENING, []), false)
  })

  it("inventory pre-turn skips notification opening", async () => {
    const result = await runStructuredInventoryPreTurn({
      turn: { text: OPENING, media: [] },
      history: [],
    })
    assert.equal(result.kind, "skip")
  })

  it("hints similar-item offer on opening — not SKU ask, not handoff yet", () => {
    const hints = buildConversationHints({ history: [], body: OPENING })
    assert.notEqual(hints, null)
    assert.match(hints!, /BACK-IN-STOCK NOTIFICATION OPENING \(534030320/)
    assert.match(hints!, /קיבלנו את הבקשה/)
    assert.match(hints!, /not human_sales yet/)
    assert.match(hints!, /never ask for מק״ט/)
    assert.doesNotMatch(hints!, /SIMILAR-ITEM FLOW/)
  })

  it("does not treat ETA restock question as notification subscription", () => {
    const etaAsk =
      "הי אשמח לפרטים נוספים לגבי שטיח אמיליה בז' EMILIA https://www.carpetshop.co.il/products/emilia-beige-rec הוא צפוי לחזור למלאי?"
    assert.equal(isBackInStockNotificationRequest(etaAsk), false)
    assert.equal(isInventoryQuestion(etaAsk), true)
  })

  it("wrong pivot reply pattern is absent from expected playbook", () => {
    assert.doesNotMatch(WRONG_REPLY, /מעביר/)
    assert.match(WRONG_REPLY, /מק״ט/)
  })
})
