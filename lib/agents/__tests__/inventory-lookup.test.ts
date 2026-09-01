import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildInventoryAvailabilityReply,
  buildProductUrlSkuPrompt,
  buildSkuRequestPrompt,
  extractSku,
  isActiveInventoryThread,
  isBareSkuMessage,
  isInventoryQuestion,
  isInventoryQuestionWithContext,
  isPreorderSku,
  looksLikeInventorySku,
  lookupInventoryBySku,
  parseInventoryBranchPayload,
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
    assert.match(buildProductDetailsOpener(), /איזה פרטים חסרים/)
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
    assert.match(buildSkuRequestPrompt(), /31503138-200290/)
    assert.doesNotMatch(buildSkuRequestPrompt(), /SKU/i)
  })

  it("detects branch display questions with region between סניף and יש", () => {
    const body = "באיזה סניף בצפון יש אותו לתצוגה"
    assert.equal(isInventoryQuestion(body), true)
  })

  it("uses recent turns for inventory follow-ups", () => {
    const history = [
      {
        role: "user" as const,
        content: "מתי השטיח nice במידה 240*340 יחזור למלאי",
        agent: null,
      },
      {
        role: "assistant" as const,
        content: "כדי לבדוק מלאי וזמינות, אצטרך את המק״ט של המוצר (לדוגמה: 31503138-200290).",
        agent: "sales",
      },
    ]
    const body = "באיזה סניף בצפון יש אותו לתצוגה"
    assert.equal(isInventoryQuestionWithContext(body, history), true)
  })

  it("accepts product URL during pending SKU request without confused handoff", async () => {
    const history = [
      {
        role: "user" as const,
        content: "מתי השטיח nice יחזור למלאi",
        agent: null,
      },
      {
        role: "assistant" as const,
        content: "כדי לבדוק מלאi, אצטרך את המק״ט (לדוגמה: 31503138-200290).",
        agent: "sales",
      },
    ]
    const url = "https://www.carpetshop.co.il/products/nice-beige-rec"
    assert.equal(shouldHandleBranchInventory(url, history), true)
    const reply = await resolveBranchInventoryReply({ body: url, history })
    assert.match(reply, /קיבלתי את הקישור/)
    assert.match(reply, /מק״ט/)
    assert.doesNotMatch(reply, /לא ברור/)
    assert.doesNotMatch(reply, /אין לי גישה/)
    assert.doesNotMatch(reply, /האם להעביר/)
  })

  it("asks for SKU without advisor offer on first inventory turn", async () => {
    const reply = await resolveBranchInventoryReply({
      body: "מתי השטיח nice במידה 240*340 יחזור למלאi",
    })
    assert.match(reply, /מק״ט/)
    assert.doesNotMatch(reply, /אין לי גישה/)
    assert.doesNotMatch(reply, /האם להעביר/)
  })

  it("buildProductUrlSkuPrompt names product from URL slug", () => {
    assert.match(buildProductUrlSkuPrompt("nice beige rec"), /nice beige rec/)
  })
})

describe("buildInventoryAvailabilityReply", () => {
  it("reports no branch stock when API returns empty inventory", () => {
    const reply = buildInventoryAvailabilityReply({
      sku: "40400025-200290",
      preorder: null,
      inventory: [],
    })
    assert.match(reply, /בדקתי את הדגם 40400025-200290/)
    assert.match(reply, /אין במלאי בסניפים/)
    assert.doesNotMatch(reply, /לא מצאתי את הדגם/)
  })

  it("reports preorder availability before branch stock", () => {
    const reply = buildInventoryAvailabilityReply({
      sku: "08800007-300400",
      product_title: "סאן קרם  SUN 300*400",
      preorder: {
        po_qty: 15,
        open_order_qty: 3,
        current_qty: 12,
        safe_qty: 3,
        req_date: "",
      },
      inventory: [{ branch_id: "WMS", quantity: 0 }],
    })
    assert.match(reply, /08800007-300400/)
    assert.match(reply, /סאן קרם/)
    assert.match(reply, /הזמנה מוקדמת/)
    assert.doesNotMatch(reply, /יש במלאי/)
    assert.doesNotMatch(reply, /WMS/)
  })

  it("includes req_date on preorder SKUs when provided", () => {
    const reply = buildInventoryAvailabilityReply({
      sku: "08800007-300400",
      preorder: {
        po_qty: 15,
        open_order_qty: 3,
        current_qty: 12,
        safe_qty: 3,
        req_date: "15/10/2026",
      },
      inventory: [],
    })
    assert.match(reply, /צפי הגעה: 15\/10\/2026/)
  })

  it("checks retail branch inventory when SKU is not on preorder", () => {
    const reply = buildInventoryAvailabilityReply({
      sku: "40400025-200290",
      preorder: null,
      inventory: [
        { branch_id: "WMS", quantity: 5 },
        { branch_id: "1001", displayName: "ראשון לציון", quantity: 2 },
        { branch_id: "1002", displayName: "נתניה", quantity: 0 },
      ],
    })
    assert.match(reply, /\*יש במלאי:\*/)
    assert.match(reply, /ראשון לציון/)
    assert.match(reply, /\*אין במלאי כרגע:\*/)
    assert.match(reply, /נתניה/)
    assert.doesNotMatch(reply, /WMS/)
    assert.doesNotMatch(reply, /1001/)
  })
})

describe("parseInventoryBranchPayload", () => {
  it("maps the new getInventoryBranch response layout", () => {
    const row = parseInventoryBranchPayload([
      {
        ok: true,
        sku: "08800007-300400",
        branch_id: "*",
        product: {
          sku: "08800007-300400",
          product_title: "סאן קרם  SUN 300*400",
        },
        inventory: [
          {
            sku: "08800007-300400",
            branch_id: "WMS",
            quantity: 0,
          },
        ],
        hasInventoryRow: true,
        preorder: {
          po_qty: 15,
          open_order_qty: 3,
          current_qty: 12,
          safe_qty: 3,
          req_date: "",
        },
      },
    ])
    assert.ok(row)
    assert.equal(row?.sku, "08800007-300400")
    assert.equal(row?.product_title, "סאן קרם  SUN 300*400")
    assert.equal(isPreorderSku(row!), true)
    assert.equal(row?.inventory.length, 1)
    assert.equal(row?.inventory[0]?.branch_id, "WMS")
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
          "בשמחה, אשמח לדעת איזה פרטים חסרים?\nניתן גם להוסיף קישור למוצר עצמו",
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
