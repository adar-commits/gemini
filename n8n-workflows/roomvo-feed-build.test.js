const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  extractStyleNumber,
  skuHasFringeFlag,
  detectShape,
  formatShekelPrice,
  formatCompareAt,
  buildDirectImageLink,
  sanitizeDisplayTitle,
  buildVariantRow,
  flattenQualifyingVariants,
  buildRoomvoFeed,
  SENTINEL_DO_NOT_DELETE,
  SENTINEL_MARKER,
} = require("./roomvo-feed-build");

describe("roomvo-feed-build helpers", () => {
  it("extracts leading style block and ignores patchwork tails", () => {
    assert.equal(extractStyleNumber("00103007-80150"), "00103007");
    assert.equal(extractStyleNumber("11100051-170240-18"), "11100051");
    assert.equal(extractStyleNumber("06516140-120120F-SQR"), "06516140");
  });

  it("detects fringe F from SKU only", () => {
    assert.equal(skuHasFringeFlag("00201007-90150F"), true);
    assert.equal(skuHasFringeFlag("06516140-120120F-SQR"), true);
    assert.equal(skuHasFringeFlag("00103007-80150"), false);
  });

  it("maps shapes including forced runners and square SKUs", () => {
    assert.deepEqual(detectShape("שטיח מרסיי 03 אפור", "00103007-80150"), {
      parentSuffix: "REC",
      imageSuffix: "RE",
      hebrew: "מלבן",
    });
    assert.deepEqual(detectShape("שטיח מרסיי 03 אפור עגול", "00103007-120120"), {
      parentSuffix: "RND",
      imageSuffix: "RD",
      hebrew: "עגול",
    });
    assert.deepEqual(
      detectShape("שטיח בלוץ אפגני 00 אדום 200*96", "11800001-96200"),
      { parentSuffix: "RNR", imageSuffix: "RN", hebrew: "ראנר" },
    );
    assert.deepEqual(
      detectShape("שטיח אטלס 16 אפור/קרם ריבוע עם פרנזים", "06516140-120120F-SQR"),
      { parentSuffix: "SQR", imageSuffix: "SQ", hebrew: "ריבוע" },
    );
  });

  it("builds image URLs without undefined", () => {
    assert.equal(
      buildDirectImageLink("00103007", "00103007-80150", "RE"),
      "https://carpetbucket.s3.eu-west-1.amazonaws.com/tempimages/00103007-RE.png",
    );
    assert.equal(
      buildDirectImageLink("00201007", "00201007-90150F", "RE"),
      "https://carpetbucket.s3.eu-west-1.amazonaws.com/tempimages/00201007F-RE.png",
    );
    assert.equal(
      buildDirectImageLink("06516140", "06516140-120120F-SQR", "SQ"),
      "https://carpetbucket.s3.eu-west-1.amazonaws.com/tempimages/06516140F-SQ.png",
    );
  });

  it("formats shekel prices and compare-at only when higher", () => {
    assert.equal(formatShekelPrice("195.00"), "195");
    assert.equal(formatShekelPrice("253.5"), "253.5");
    assert.equal(formatCompareAt("195", "390"), "390");
    assert.equal(formatCompareAt("8750", "8750"), "");
    assert.equal(formatCompareAt("8750", ""), "");
  });

  it("strips Latin letters from column A display title", () => {
    assert.equal(
      sanitizeDisplayTitle("שטיח מרקש 01 קרם-שחור MARAKESH"),
      "שטיח מרקש 01 קרם-שחור",
    );
    assert.equal(sanitizeDisplayTitle("שטיח מרסיי 03 אפור"), "שטיח מרסיי 03 אפור");
  });
});

describe("buildVariantRow", () => {
  it("builds Marseille 03 Grey XS with clean cart link", () => {
    const row = buildVariantRow({
      id: "40957728293055",
      sku: "00103007-80150",
      title: "80*150 - XS",
      price: "195",
      compareAtPrice: "390",
      inventoryQuantity: 13,
      productTitle: "שטיח מרסיי 03 אפור",
      handle: "marseille-03-grey",
    });

    assert.equal(row[0], "שטיח מרסיי 03 אפור");
    assert.equal(row[1], "00103007-80150");
    assert.equal(row[2], "00103007-REC");
    assert.equal(row[8], "195");
    assert.equal(row[9], "390");
    assert.equal(row[12], "https://www.carpetshop.co.il/cart/add?id=40957728293055");
    assert.equal(row[12].includes("}#addr"), false);
    assert.equal(row[12].includes("#addr"), false);
    assert.equal(row[14], "מלבן");
  });

  it("uses F in image for fringe SKU but not title-only פרנזים", () => {
    const withFringeSku = buildVariantRow({
      id: "1",
      sku: "03243073-120120F",
      title: "120*120 - M",
      price: "450",
      compareAtPrice: "750",
      inventoryQuantity: 1,
      productTitle: "שטיח מילאנו 43 לבן/אפור עם פרנזים",
      handle: "milano-43-white-grey-with-fringes",
    });
    assert.match(withFringeSku[10], /03243073F-RE\.png$/);

    const titleOnlyFringe = buildVariantRow({
      id: "2",
      sku: "03248062-80300",
      title: "80*300 - L",
      price: "745",
      compareAtPrice: "1490",
      inventoryQuantity: 1,
      productTitle: "שטיח מילאנו 48 כחול ראנר",
      handle: "milano-48-blue-runner",
    });
    assert.match(titleOnlyFringe[10], /03248062-RN\.png$/);
    assert.doesNotMatch(titleOnlyFringe[10], /F-/);
  });

  it("strips English from column A while keeping shape detection on raw title", () => {
    const row = buildVariantRow({
      id: "40957839933631",
      sku: "00103007-80150",
      title: "80*150 - XS",
      price: "195",
      compareAtPrice: null,
      inventoryQuantity: 5,
      productTitle: "שטיח מרקש 01 קרם-שחור MARAKESH",
      handle: "marakesh-01-cream-black",
    });

    assert.equal(row[0], "שטיח מרקש 01 קרם-שחור");
    assert.equal(row[12], "https://www.carpetshop.co.il/cart/add?id=40957839933631");
    assert.equal(row[14], "מלבן");
  });
});

describe("flattenQualifyingVariants", () => {
  it("includes rugs with stock and excludes poufs", () => {
    const rug = flattenQualifyingVariants({
      title: "שטיח מרסיי 03 אפור",
      handle: "marseille-03-grey",
      variants: [
        {
          id: "1",
          sku: "00103007-80150",
          title: "80*150 - XS",
          price: "195",
          compareAtPrice: "390",
          inventoryQuantity: 13,
        },
        {
          id: "2",
          sku: "00103007-000000",
          title: "sold out",
          price: "195",
          compareAtPrice: null,
          inventoryQuantity: 0,
        },
      ],
    });
    assert.equal(rug.length, 1);
    assert.equal(rug[0].sku, "00103007-80150");

    const pouf = flattenQualifyingVariants({
      title: "פוף אלמר 01 כחול/לבן ELMAR",
      handle: "elmar-pouf",
      variants: [
        {
          id: "3",
          sku: "23201066-505035",
          title: "50*50",
          price: "100",
          compareAtPrice: null,
          inventoryQuantity: 5,
        },
      ],
    });
    assert.equal(pouf.length, 0);
  });
});

describe("buildRoomvoFeed merge", () => {
  const header = [
    "Title",
    "Variant SKU",
    "Parent SKU",
    "Size",
    "SKU should be visible in the interface?",
    "Parent SKU button should be visible?",
    "Variant Inventory Qty",
    "Variant Barcode",
    "Price Sold At",
    "Price Before Sale (If Available)",
    "Direct Image Link",
    "URL",
    "Add to Cart Link - הוספה לעגלה",
    "Filters\n Size Family - מידה",
    "Filters\n Shape - צורה",
    "Filters\n Color Families - צבע",
    "Filters\n Features - סטייל",
    "Image Status",
    "special url",
  ];

  const existingSheetRows = [
    header,
    [
      SENTINEL_DO_NOT_DELETE,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "https://carpetbucket.s3.eu-west-1.amazonaws.com/tempimages/00115149-173233-RE.png",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ],
    [
      "שטיח מרסיי 03 אפור",
      "00103007-80150",
      "00103007-REC",
      "80*150 - XS",
      "Yes",
      "Yes",
      "13",
      "0",
      "195",
      "390",
      "https://carpetbucket.s3.eu-west-1.amazonaws.com/tempimages/00103007-RE.png",
      "https://www.carpetshop.co.il/products/marseille-03-grey",
      "https://www.carpetshop.co.il/products/marseille-03-grey?variant=40957728293055}#addr",
      "80*150 - XS",
      "מלבן",
      "אפור",
      "וינטג', קלאסי",
      "",
      "",
    ],
    [
      "שטיח מרסיי 03 אפור",
      "00103007-120170",
      "00103007-REC",
      "120*170 - S",
      "Yes",
      "Yes",
      "18",
      "0",
      "245",
      "490",
      "https://carpetbucket.s3.eu-west-1.amazonaws.com/tempimages/00103007-RE.png",
      "https://www.carpetshop.co.il/products/marseille-03-grey",
      "https://www.carpetshop.co.il/products/marseille-03-grey?variant=40957728325823}#addr",
      "120*170 - S",
      "מלבן",
      "אפור",
      "וינטג', קלאסי",
      "",
      "",
    ],
    [
      "שטיח OLD OUT OF STOCK",
      "99999999-111111",
      "99999999-REC",
      "100*100 - M",
      "Yes",
      "Yes",
      "1",
      "0",
      "100",
      "",
      "https://carpetbucket.s3.eu-west-1.amazonaws.com/tempimages/99999999-RE.png",
      "https://www.carpetshop.co.il/products/old",
      "https://www.carpetshop.co.il/products/old?variant=1",
      "100*100 - M",
      "מלבן",
      "אפור",
      "old style",
      "",
      "",
    ],
    [
      SENTINEL_MARKER,
      SENTINEL_MARKER,
      SENTINEL_MARKER,
      SENTINEL_MARKER,
      SENTINEL_MARKER,
      SENTINEL_MARKER,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ],
  ];

  const shopifyProducts = [
    {
      title: "שטיח מרסיי 03 אפור",
      handle: "marseille-03-grey",
      variants: [
        {
          id: "40957728293055",
          sku: "00103007-80150",
          title: "80*150 - XS",
          price: "195",
          compareAtPrice: "390",
          inventoryQuantity: 10,
        },
        {
          id: "40957728325823",
          sku: "00103007-120170",
          title: "120*170 - S",
          price: "245",
          compareAtPrice: "490",
          inventoryQuantity: 18,
        },
      ],
    },
    {
      title: "שטיח BRAND NEW PRODUCT",
      handle: "brand-new-product",
      variants: [
        {
          id: "55555555555555",
          sku: "88888888-80150",
          title: "80*150 - XS",
          price: "300",
          compareAtPrice: null,
          inventoryQuantity: 2,
        },
      ],
    },
  ];

  it("preserves row order, sentinels, filters, and removes stale SKUs", () => {
    const result = buildRoomvoFeed({ existingSheetRows, shopifyProducts });

    assert.equal(result.bodyRows[0][0], SENTINEL_DO_NOT_DELETE);
    assert.equal(
      result.bodyRows[0][10],
      "https://carpetbucket.s3.eu-west-1.amazonaws.com/tempimages/00115149-173233-RE.png",
    );

    const dataSkus = result.bodyRows.slice(1, -1).map((r) => r[1]);
    assert.deepEqual(dataSkus, [
      "00103007-80150",
      "00103007-120170",
      "88888888-80150",
    ]);
    assert.equal(result.bodyRows.at(-1)[0], SENTINEL_MARKER);

    const first = result.bodyRows[1];
    assert.equal(first[6], "10");
    assert.equal(first[15], "אפור");
    assert.equal(first[16], "וינטג', קלאסי");
    assert.equal(
      first[12],
      "https://www.carpetshop.co.il/cart/add?id=40957728293055",
    );

    assert.deepEqual(result.newSkusMissingFilters, ["88888888-80150"]);
    assert.equal(result.stats.newSkus, 1);
    assert.ok(result.stats.removedSkus >= 1);
  });

  it("does not include header row in bodyRows", () => {
    const result = buildRoomvoFeed({ existingSheetRows, shopifyProducts });
    assert.notEqual(result.bodyRows[0][0], "Title");
  });

  it("copies filters from sibling variant for new SKU on same product", () => {
    const siblingSheet = [
      header,
      [
        SENTINEL_DO_NOT_DELETE,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "https://carpetbucket.s3.eu-west-1.amazonaws.com/tempimages/00115149-173233-RE.png",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ],
      [
        "שטיח מרסיי 03 אפור",
        "00103007-80150",
        "00103007-REC",
        "80*150 - XS",
        "Yes",
        "Yes",
        "13",
        "0",
        "195",
        "390",
        "https://carpetbucket.s3.eu-west-1.amazonaws.com/tempimages/00103007-RE.png",
        "https://www.carpetshop.co.il/products/marseille-03-grey",
        "https://www.carpetshop.co.il/products/marseille-03-grey?variant=40957728293055",
        "80*150 - XS",
        "מלבן",
        "אפור",
        "shared features",
        "",
        "",
      ],
      Array.from({ length: 19 }, (_, i) => (i < 6 ? SENTINEL_MARKER : "")),
    ];

    const result = buildRoomvoFeed({
      existingSheetRows: siblingSheet,
      shopifyProducts: [
        {
          title: "שטיח מרסיי 03 אפור",
          handle: "marseille-03-grey",
          variants: [
            {
              id: "40957728293055",
              sku: "00103007-80150",
              title: "80*150 - XS",
              price: "195",
              compareAtPrice: "390",
              inventoryQuantity: 13,
            },
            {
              id: "40957728325823",
              sku: "00103007-120170",
              title: "120*170 - S",
              price: "245",
              compareAtPrice: "490",
              inventoryQuantity: 18,
            },
          ],
        },
      ],
    });

    const newRow = result.bodyRows.find((r) => r[1] === "00103007-120170");
    assert.ok(newRow);
    assert.equal(newRow[15], "אפור");
    assert.equal(newRow[16], "shared features");
    assert.deepEqual(result.newSkusMissingFilters, []);
  });
});
