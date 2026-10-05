"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  buildRoomvoFeed,
  COLUMN_COUNT,
  SENTINEL_DO_NOT_DELETE,
  SENTINEL_MARKER,
} = require("./roomvo-feed-build");

function numericVariantId(gid) {
  const match = String(gid || "").match(/(\d+)$/);
  return match ? match[1] : String(gid || "");
}

function parseShopifyPage(response) {
  const payload = response?.data?.products;
  if (!payload) {
    throw new Error(`Shopify GraphQL error: ${JSON.stringify(response?.errors || response)}`);
  }

  const products = [];
  for (const node of payload.nodes || []) {
    products.push({
      title: node.title,
      handle: node.handle,
      variants: (node.variants?.nodes || []).map((variant) => ({
        id: numericVariantId(variant.id),
        sku: variant.sku || "",
        title: variant.title || "",
        price: variant.price,
        compareAtPrice: variant.compareAtPrice,
        inventoryQuantity: variant.inventoryQuantity ?? 0,
      })),
    });
  }

  return {
    products,
    hasNext: Boolean(payload.pageInfo?.hasNextPage),
    cursor: payload.pageInfo?.endCursor || null,
  };
}

function accumulatePages(pages, staticStore) {
  staticStore.shopifyProducts = [];
  for (const page of pages) {
    const parsed = parseShopifyPage(page);
    staticStore.shopifyProducts.push(...parsed.products);
    if (!parsed.hasNext) {
      return parsed;
    }
  }
  throw new Error("pagination did not terminate");
}

describe("roomvo feed pipeline (Shopify HTTP + Code nodes)", () => {
  it("accumulates paginated Shopify responses then builds sheet payload", () => {
    const page1 = {
      data: {
        products: {
          pageInfo: { hasNextPage: true, endCursor: "cursor-2" },
          nodes: [
            {
              title: "שטיח Marseille 03 Grey",
              handle: "marseille-03-grey",
              variants: {
                nodes: [
                  {
                    id: "gid://shopify/ProductVariant/40957728293055",
                    sku: "00103007-80150",
                    title: "160*230 - L",
                    price: "195.00",
                    compareAtPrice: null,
                    inventoryQuantity: 3,
                  },
                ],
              },
            },
          ],
        },
      },
    };

    const page2 = {
      data: {
        products: {
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes: [
            {
              title: "שטיח Test Runner",
              handle: "test-runner",
              variants: {
                nodes: [
                  {
                    id: "gid://shopify/ProductVariant/999",
                    sku: "11800001-96200",
                    title: "80*250",
                    price: "120.00",
                    compareAtPrice: null,
                    inventoryQuantity: 1,
                  },
                ],
              },
            },
          ],
        },
      },
    };

    const staticStore = {};
    accumulatePages([page1, page2], staticStore);
    assert.equal(staticStore.shopifyProducts.length, 2);

    const existingSheetRows = [
      [
        "Title",
        "Parent SKU",
        "SKU",
        "Size",
        "Filters\n Size Family - מידה",
        "Filters\n Shape - צורה",
        "Filters\n Color Families - צבע",
        "Filters\n Features - סטייל",
        "Image",
        "URL",
        "Cart Link",
        "Visible",
        "Visible in Roomvo",
        "Barcode",
        "Inventory",
        "Price Sold At",
        "Price Before Sale",
        "Image Status",
        "special url",
        "stock",
      ],
      Array(COLUMN_COUNT).fill(""),
      existingRow("00103007-80150", "Grey", "Classic"),
      Array(COLUMN_COUNT).fill(SENTINEL_MARKER),
    ];

    function existingRow(sku, color, style) {
      const row = Array(COLUMN_COUNT).fill("");
      row[1] = sku;
      row[14] = "REC";
      row[15] = color;
      row[16] = style;
      return row;
    }

    const result = buildRoomvoFeed({
      existingSheetRows,
      shopifyProducts: staticStore.shopifyProducts,
    });

    assert.equal(result.bodyRows[0][0], SENTINEL_DO_NOT_DELETE);
    assert.equal(result.bodyRows.at(-1)[0], SENTINEL_MARKER);
    assert.ok(result.bodyRows.some((row) => row[1] === "00103007-80150"));
    assert.ok(result.bodyRows.some((row) => row[1] === "11800001-96200"));
    assert.ok(
      result.bodyRows.every(
        (row) => !String(row[12] || "").includes("}#addr"),
      ),
    );
    const dataRow = result.bodyRows.find((row) => row[1] === "00103007-80150");
    assert.ok(dataRow);
    assert.equal(dataRow[19], "3");
  });
});
