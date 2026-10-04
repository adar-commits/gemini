/**
 * Pure Roomvo catalog builder — shared by unit tests and the n8n Code node.
 * Column order matches OsherSheet (19 columns, A–S).
 */

/** @typedef {{ title: string, handle: string, variants: ShopifyVariant[] }} ShopifyProduct */
/** @typedef {{ id: string, sku: string, title: string, price: string, compareAtPrice: string|null, inventoryQuantity: number }} ShopifyVariant */

const FORCED_RUNNER_SKUS = new Set([
  "11800001-96200",
  "11800192-101193",
  "13000001-98190",
]);

const SENTINEL_DO_NOT_DELETE = "DO NOT DELETE ME";
const SENTINEL_MARKER = "XXXXXXXXXXXXX";

const IMAGE_BASE =
  "https://carpetbucket.s3.eu-west-1.amazonaws.com/tempimages";
const STORE_BASE = "https://www.carpetshop.co.il/products";

/** Leading digit block of the variant SKU (patchwork tails ignored). */
function extractStyleNumber(sku) {
  const match = String(sku || "").match(/^(\d+)/);
  return match ? match[1] : "";
}

/** F belongs in the image URL only when the SKU carries F on the size segment. */
function skuHasFringeFlag(sku) {
  return /\d+F(?:-SQR)?$/.test(String(sku || ""));
}

/**
 * @param {string} title
 * @param {string} sku
 */
function detectShape(title, sku) {
  if (FORCED_RUNNER_SKUS.has(sku)) {
    return { parentSuffix: "RNR", imageSuffix: "RN", hebrew: "ראנר" };
  }
  if (title.includes("ריבוע") || sku.endsWith("-SQR")) {
    return { parentSuffix: "SQR", imageSuffix: "SQ", hebrew: "ריבוע" };
  }
  if (title.includes("ראנר")) {
    return { parentSuffix: "RNR", imageSuffix: "RN", hebrew: "ראנר" };
  }
  if (title.includes("עגול")) {
    return { parentSuffix: "RND", imageSuffix: "RD", hebrew: "עגול" };
  }
  return { parentSuffix: "REC", imageSuffix: "RE", hebrew: "מלבן" };
}

/** @param {string|number|null|undefined} amount */
function formatShekelPrice(amount) {
  if (amount === null || amount === undefined || amount === "") return "";
  const n = Number(amount);
  if (!Number.isFinite(n)) return "";
  if (Number.isInteger(n)) return String(n);
  return String(parseFloat(n.toFixed(2)));
}

/**
 * @param {string} price
 * @param {string|null|undefined} compareAt
 */
function formatCompareAt(price, compareAt) {
  const sold = Number(price);
  const before = Number(compareAt);
  if (!Number.isFinite(before) || !Number.isFinite(sold) || before <= sold) {
    return "";
  }
  return formatShekelPrice(before);
}

/**
 * @param {string} style
 * @param {string} sku
 * @param {string} imageSuffix
 */
function buildDirectImageLink(style, sku, imageSuffix) {
  if (!style || !imageSuffix) return "";
  const fringe = skuHasFringeFlag(sku) ? "F" : "";
  return `${IMAGE_BASE}/${style}${fringe}-${imageSuffix}.png`;
}

/**
 * @param {ShopifyVariant & { productTitle: string, handle: string }} variant
 */
function buildVariantRow(variant) {
  const sku = variant.sku || "";
  const title = variant.productTitle || "";
  const style = extractStyleNumber(sku);
  const shape = detectShape(title, sku);
  const parentSku = style ? `${style}-${shape.parentSuffix}` : "";
  const size = variant.title || "";
  const price = formatShekelPrice(variant.price);
  const compareAt = formatCompareAt(variant.price, variant.compareAtPrice);
  const inventory = Math.trunc(Number(variant.inventoryQuantity));
  const url = `${STORE_BASE}/${variant.handle}`;
  const cartUrl = `${url}?variant=${variant.id}`;

  return [
    title,
    sku,
    parentSku,
    size,
    "Yes",
    "Yes",
    String(inventory),
    "0",
    price,
    compareAt,
    buildDirectImageLink(style, sku, shape.imageSuffix),
    url,
    cartUrl,
    size,
    shape.hebrew,
    "",
    "",
    "",
    "",
  ];
}

/** @param {string[][]} rows */
function rowToRecord(row) {
  return {
    title: row[0] || "",
    variantSku: row[1] || "",
    parentSku: row[2] || "",
    size: row[3] || "",
    skuVisible: row[4] || "",
    parentVisible: row[5] || "",
    inventoryQty: row[6] || "",
    barcode: row[7] || "",
    priceSoldAt: row[8] || "",
    priceBeforeSale: row[9] || "",
    directImageLink: row[10] || "",
    url: row[11] || "",
    cartLink: row[12] || "",
    filterSizeFamily: row[13] || "",
    filterShape: row[14] || "",
    filterColorFamilies: row[15] || "",
    filterFeatures: row[16] || "",
    imageStatus: row[17] || "",
    specialUrl: row[18] || "",
  };
}

/** @param {ReturnType<typeof rowToRecord>} rec */
function recordToRow(rec) {
  return [
    rec.title,
    rec.variantSku,
    rec.parentSku,
    rec.size,
    rec.skuVisible,
    rec.parentVisible,
    rec.inventoryQty,
    rec.barcode,
    rec.priceSoldAt,
    rec.priceBeforeSale,
    rec.directImageLink,
    rec.url,
    rec.cartLink,
    rec.filterSizeFamily,
    rec.filterShape,
    rec.filterColorFamilies,
    rec.filterFeatures,
    rec.imageStatus,
    rec.specialUrl,
  ];
}

/**
 * @param {ShopifyProduct} product
 * @returns {(ShopifyVariant & { productTitle: string, handle: string })[]}
 */
function flattenQualifyingVariants(product) {
  const title = product.title || "";
  if (!title.startsWith("שטיח")) return [];

  return (product.variants || [])
    .filter((v) => {
      const qty = Math.trunc(Number(v.inventoryQuantity));
      return v.sku && qty > 0;
    })
    .map((v) => ({
      ...v,
      productTitle: title,
      handle: product.handle,
    }));
}

/**
 * @param {string[][]} existingSheetRows Full sheet including header (row 0).
 */
function parseExistingSheet(existingSheetRows) {
  /** @type {string[][]} */
  const dataRows = [];
  /** @type {string[]|null} */
  let doNotDeleteRow = null;
  /** @type {string[]|null} */
  let markerRow = null;

  for (let i = 1; i < existingSheetRows.length; i += 1) {
    const row = existingSheetRows[i];
    const title = row[0] || "";
    if (title === SENTINEL_DO_NOT_DELETE) {
      doNotDeleteRow = [...row];
      while (doNotDeleteRow.length < 19) doNotDeleteRow.push("");
      continue;
    }
    if (title === SENTINEL_MARKER) {
      markerRow = [...row];
      while (markerRow.length < 19) markerRow.push("");
      continue;
    }
    const sku = row[1] || "";
    if (!sku) continue;
    dataRows.push([...row]);
    while (dataRows[dataRows.length - 1].length < 19) {
      dataRows[dataRows.length - 1].push("");
    }
  }

  /** @type {Map<string, ReturnType<typeof rowToRecord>>} */
  const bySku = new Map();
  /** @type {Map<string, { color: string, features: string }>} */
  const filtersByHandle = new Map();

  for (const row of dataRows) {
    const rec = rowToRecord(row);
    if (rec.variantSku) bySku.set(rec.variantSku, rec);
    if (rec.url) {
      const handleMatch = rec.url.match(/\/products\/([^/?#]+)/);
      const handle = handleMatch ? handleMatch[1] : "";
      if (
        handle &&
        (rec.filterColorFamilies || rec.filterFeatures) &&
        !filtersByHandle.has(handle)
      ) {
        filtersByHandle.set(handle, {
          color: rec.filterColorFamilies,
          features: rec.filterFeatures,
        });
      }
    }
  }

  return {
    dataRows,
    doNotDeleteRow,
    markerRow,
    bySku,
    filtersByHandle,
  };
}

/**
 * @param {{
 *   existingSheetRows: string[][],
 *   shopifyProducts: ShopifyProduct[],
 * }} input
 */
function buildRoomvoFeed(input) {
  const { existingSheetRows, shopifyProducts } = input;
  const parsed = parseExistingSheet(existingSheetRows);

  /** @type {Map<string, ReturnType<typeof buildVariantRow>>} */
  const shopifyRowsBySku = new Map();
  for (const product of shopifyProducts) {
    for (const variant of flattenQualifyingVariants(product)) {
      shopifyRowsBySku.set(variant.sku, buildVariantRow(variant));
    }
  }

  /** @type {string[]} */
  const newSkusMissingFilters = [];
  /** @type {string[][]} */
  const outputDataRows = [];

  const seenSkus = new Set();

  for (const existingRow of parsed.dataRows) {
    const existing = rowToRecord(existingRow);
    const sku = existing.variantSku;
    const built = shopifyRowsBySku.get(sku);
    if (!built) continue;

    seenSkus.add(sku);
    const merged = rowToRecord(built);

    merged.filterColorFamilies = existing.filterColorFamilies;
    merged.filterFeatures = existing.filterFeatures;

    if (!merged.filterColorFamilies || !merged.filterFeatures) {
      const handleMatch = merged.url.match(/\/products\/([^/?#]+)/);
      const handle = handleMatch ? handleMatch[1] : "";
      const sibling = handle ? parsed.filtersByHandle.get(handle) : undefined;
      if (sibling) {
        if (!merged.filterColorFamilies) merged.filterColorFamilies = sibling.color;
        if (!merged.filterFeatures) merged.filterFeatures = sibling.features;
      }
    }

    outputDataRows.push(recordToRow(merged));
  }

  /** New SKUs in stable title/sku order before the marker row. */
  const newVariants = [];
  for (const product of shopifyProducts) {
    for (const variant of flattenQualifyingVariants(product)) {
      if (seenSkus.has(variant.sku)) continue;
      newVariants.push(variant);
    }
  }
  newVariants.sort((a, b) => {
    const titleCmp = a.productTitle.localeCompare(b.productTitle, "he");
    if (titleCmp !== 0) return titleCmp;
    return a.sku.localeCompare(b.sku);
  });

  for (const variant of newVariants) {
    const built = buildVariantRow(variant);
    const merged = rowToRecord(built);
    const handle = variant.handle;
    const sibling = parsed.filtersByHandle.get(handle);
    if (sibling) {
      merged.filterColorFamilies = sibling.color;
      merged.filterFeatures = sibling.features;
    } else {
      newSkusMissingFilters.push(variant.sku);
    }
    outputDataRows.push(recordToRow(merged));
    seenSkus.add(variant.sku);
  }

  const doNotDeleteRow =
    parsed.doNotDeleteRow ||
    Array.from({ length: 19 }, (_, i) =>
      i === 0 ? SENTINEL_DO_NOT_DELETE : "",
    );
  const markerRow =
    parsed.markerRow ||
    Array.from({ length: 19 }, (_, i) =>
      i < 6 ? SENTINEL_MARKER : "",
    );

  const bodyRows = [doNotDeleteRow, ...outputDataRows, markerRow];

  return {
    /** Rows to write starting at sheet row 2 (excludes header). */
    bodyRows,
    newSkusMissingFilters,
    stats: {
      qualifyingVariants: shopifyRowsBySku.size,
      outputDataRows: outputDataRows.length,
      removedSkus: parsed.dataRows.length - outputDataRows.length + newVariants.length,
      newSkus: newVariants.length,
    },
  };
}

module.exports = {
  FORCED_RUNNER_SKUS,
  SENTINEL_DO_NOT_DELETE,
  SENTINEL_MARKER,
  extractStyleNumber,
  skuHasFringeFlag,
  detectShape,
  formatShekelPrice,
  formatCompareAt,
  buildDirectImageLink,
  buildVariantRow,
  rowToRecord,
  recordToRow,
  flattenQualifyingVariants,
  parseExistingSheet,
  buildRoomvoFeed,
};
