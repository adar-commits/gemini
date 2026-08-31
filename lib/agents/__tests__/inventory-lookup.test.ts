import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildInventoryAvailabilityReply,
  buildSkuRequestPrompt,
  extractSku,
  isBareSkuMessage,
  isInventoryQuestion,
  lookupInventoryBySku,
  resolveBranchInventoryReply,
} from "@/lib/agents/inventory-lookup"
import {
  buildProductDetailsOpener,
  buildProductUrlRequest,
  isProductDetailsRequest,
  isProductInventoryQuestion,
  isSpecificProductMention,
} from "@/lib/agents/product-handoff"

describe("extractSku", () => {
  it("recognizes Hom 8-6 digit SKU format", () => {
    assert.equal(extractSku("40400025-200290"), "40400025-200290")
    assert.equal(isBareSkuMessage("40400025-200290"), true)
  })
})

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

  it("uses product details opener for Landbot-style requests", () => {
    const body =
      "היי אשמח לפרטים נוספים לגבי שטיח טרנדי 03 צבעוני TRENDY"
    assert.equal(isProductDetailsRequest(body), true)
    assert.equal(isSpecificProductMention(body), false)
    assert.match(buildProductDetailsOpener(), /איזה פרטים חסרים לך/)
    assert.match(buildProductDetailsOpener(), /קישור למוצר/)
  })

  it("product details with color ask uses opener first", () => {
    const body = "פרטים נוספים לגבי שטיח קזבלנקה — יש עוד צבעים?"
    assert.equal(isProductDetailsRequest(body), true)
    assert.equal(isSpecificProductMention(body), false)
    assert.match(buildProductDetailsOpener(), /איזה פרטים חסרים/)
  })

  it("asks for URL on named model without details phrasing", () => {
    const body = "יש עוד צבעים לקזבלנקה?"
    assert.equal(isProductDetailsRequest(body), false)
    assert.equal(isSpecificProductMention(body), true)
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

describe("buildInventoryAvailabilityReply", () => {
  it("reports no branch stock when API returns empty warehouses", () => {
    const reply = buildInventoryAvailabilityReply({
      sku: "40400025-200290",
      warehouses_inventory: [],
    })
    assert.match(reply, /בדקתי את הדגם 40400025-200290/)
    assert.match(reply, /אין במלאי בסניפים/)
    assert.doesNotMatch(reply, /לא מצאתי את הדגם/)
  })
})

describe("lookupInventoryBySku", () => {
  it("parses live webhook payload with empty warehouses", async () => {
    const result = await lookupInventoryBySku("40400025-200290")
    assert.ok(result)
    assert.equal(result?.sku, "40400025-200290")
    assert.ok(Array.isArray(result?.warehouses_inventory))
  })
})
