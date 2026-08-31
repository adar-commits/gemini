import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildInventoryAvailabilityReply,
  buildSkuRequestPrompt,
  extractSku,
  isActiveInventoryThread,
  isBareSkuMessage,
  isInventoryQuestion,
  looksLikeInventorySku,
  lookupInventoryBySku,
  resolveBranchInventoryReply,
  shouldHandleBranchInventory,
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
  it("does not invent a branch from product names like Riviera", async () => {
    const body =
      "היי, אשמח לשמוע פרטים נוספים על פוף ריביירה פרנדלי זוגי חול FRIENDLY COUPLE. האם יש צפי לחזרה למלאי?"
    assert.equal(isInventoryQuestion(body), true)
    const reply = await resolveBranchInventoryReply({ body })
    assert.match(reply, /מק״ט/)
    assert.doesNotMatch(reply, /יירה/)
    assert.doesNotMatch(reply, /בסניף/)
  })

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

  it("routes follow-up SKU questions in an inventory thread", async () => {
    const history = [
      {
        role: "user" as const,
        content: "50016308-9810070",
        agent: null,
      },
      {
        role: "assistant" as const,
        content:
          "*הום בוט :)*\nבדקתי זמינות לדגם 50016308-9810070:\n\n*אין במלאי כרגע:*",
        agent: "sales",
      },
    ]
    const body = "ומהדגם 50016315-9810070?"
    assert.equal(isActiveInventoryThread(history), true)
    assert.equal(shouldHandleBranchInventory(body, history), true)
    assert.equal(extractSku(body), "50016315-9810070")
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
  it("does not extract SKU slug from product URLs", () => {
    const url =
      "https://www.carpetshop.co.il/products/topaz-cream-green?variant=44355920298175"
    assert.equal(extractSku(url), null)
    assert.equal(looksLikeInventorySku(url), false)
  })
})

describe("product URL sales handoff", () => {
  it("routes product URL in prep thread to handoff without inventory SKU", async () => {
    const { buildProductHandoffAfterReference, isActiveProductSalesPrepThread } =
      await import("@/lib/agents/product-handoff")
    const history = [
      {
        role: "user" as const,
        content: "היי אשמח לפרטים נוספים לגבי שטיח טרנדי",
      },
      {
        role: "assistant" as const,
        content:
          "בשמחה, אשמח לדעת איזה פרטים חסרים לך?\nניתן גם להוסיף קישור למוצר עצמו",
      },
      { role: "user" as const, content: "הוא מתאים לילדים?" },
    ]
    assert.equal(isActiveProductSalesPrepThread(history), true)
    assert.match(
      buildProductHandoffAfterReference(
        "https://www.carpetshop.co.il/products/topaz-cream-green"
      ),
      /האם להעביר/
    )
    assert.doesNotMatch(buildProductHandoffAfterReference("url"), /תקלה/)
  })
})
