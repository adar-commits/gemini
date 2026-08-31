import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildSkuRequestPrompt,
  isInventoryQuestion,
  resolveBranchInventoryReply,
} from "@/lib/agents/inventory-lookup"
import {
  buildProductUrlRequest,
  isProductInventoryQuestion,
  isSpecificProductMention,
} from "@/lib/agents/product-handoff"

describe("isInventoryQuestion", () => {
  it("detects restock questions without branch or model name", () => {
    const body = "הי רציתי לדעת אם השטיח הזה יחזור למלאי?"
    assert.equal(isInventoryQuestion(body), true)
  })

  it("detects branch stock checks", () => {
    assert.equal(isInventoryQuestion("יש 31501090-200290 בסניפים?"), true)
  })

  it("does not treat price-only asks as inventory", () => {
    assert.equal(isInventoryQuestion("כמה עולה קזבלנקה?"), false)
  })
})

describe("inventory vs product URL routing", () => {
  it("asks for SKU on inventory questions", async () => {
    const reply = await resolveBranchInventoryReply({
      body: "האם השטיח יחזור למלאי?",
    })
    assert.match(reply, /מק״ט/)
    assert.doesNotMatch(reply, /קישור/)
  })

  it("asks for URL on product detail questions without stock", () => {
    const body = "פרטים נוספים לגבי שטיח קזבלנקה — יש עוד צבעים?"
    assert.equal(isInventoryQuestion(body), false)
    assert.equal(isSpecificProductMention(body), true)
    assert.doesNotMatch(buildProductUrlRequest(), /מק״ט/)
    assert.match(buildProductUrlRequest(), /קישור/)
  })

  it("routes named-model stock to inventory not URL handoff", () => {
    const body = "האם קזבלנקה במלאי?"
    assert.equal(isInventoryQuestion(body), true)
    assert.equal(isProductInventoryQuestion(body), false)
    assert.equal(isSpecificProductMention(body), false)
    assert.match(buildSkuRequestPrompt(), /מק״ט/)
  })
})
