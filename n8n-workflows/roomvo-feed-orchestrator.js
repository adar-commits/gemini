/**
 * n8n Code node orchestration — appended after roomvo-feed-build.js in the deployed workflow.
 * Expects $input.first().json.values from a Google Sheets values read (OsherSheet!A:T).
 */

const SHEET_ID = "1-1Hqtq0iyomItaf7dU4q4JHJgIZ1a0hCKIojVDUdWoE";
const SHOPIFY_GRAPHQL =
  "https://redcarpetil.myshopify.com/admin/api/2025-10/graphql.json";

const PRODUCTS_QUERY = `
  query RoomvoProducts($cursor: String) {
    products(first: 100, after: $cursor, query: "status:active published_status:published") {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        title
        handle
        variants(first: 100) {
          nodes {
            id
            sku
            title
            price
            compareAtPrice
            inventoryQuantity
          }
        }
      }
    }
  }
`;

function numericVariantId(gid) {
  const match = String(gid || "").match(/(\d+)$/);
  return match ? match[1] : String(gid || "");
}

/**
 * Shopify pagination runs in HTTP Request + Accumulate Code nodes (not in Code auth).
 * See scripts/push-roomvo-feed-workflow.py for the deployed n8n graph.
 */
function parseShopifyPage(response) {
  const payload = response?.data?.products;
  if (!payload) {
    throw new Error(
      `Shopify GraphQL error: ${JSON.stringify(response?.errors || response)}`,
    );
  }

  /** @type {import('./roomvo-feed-build').ShopifyProduct[]} */
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

function israelTimestamp() {
  return new Date().toLocaleString("en-GB", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * @param {{
 *   existingSheetRows: string[][],
 *   shopifyProducts: import('./roomvo-feed-build').ShopifyProduct[],
 *   previousRowCount: number,
 * }} input
 */
function buildRunPayload(input) {
  const result = buildRoomvoFeed({
    existingSheetRows: input.existingSheetRows,
    shopifyProducts: input.shopifyProducts,
  });

  const writeEndRow = result.bodyRows.length + 1;
  const previousLastRow = input.previousRowCount;
  const clearFromRow =
    previousLastRow > writeEndRow ? writeEndRow + 1 : null;
  const clearToRow =
    previousLastRow > writeEndRow ? previousLastRow : null;

  return {
    sheetId: SHEET_ID,
    sheetName: "OsherSheet",
    bodyRows: result.bodyRows,
    writeRange: `OsherSheet!A2:T${writeEndRow}`,
    clearRange:
      clearFromRow && clearToRow
        ? `OsherSheet!A${clearFromRow}:T${clearToRow}`
        : "",
    logRow: [
      israelTimestamp(),
      String(result.stats.outputDataRows),
      result.newSkusMissingFilters.join(", "),
    ],
    newSkusMissingFilters: result.newSkusMissingFilters,
    stats: result.stats,
  };
}

module.exports = {
  SHEET_ID,
  SHOPIFY_GRAPHQL,
  PRODUCTS_QUERY,
  numericVariantId,
  parseShopifyPage,
  israelTimestamp,
  buildRunPayload,
};
