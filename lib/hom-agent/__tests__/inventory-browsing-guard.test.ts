import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { executeLookupInventory } from "@/lib/hom-agent/tools/inventory"

describe("inventory tool browsing guard", () => {
  it("refuses product-type browsing without a valid SKU (wool regression)", async () => {
    const result = await executeLookupInventory({
      body: "אני מחפש שטיח צמר לסלון שקל לניקוי",
      history: [],
    })
    assert.equal(result.ok, false)
    assert.match((result as { error: string }).error, /מק״ט/)
  })

  it("refuses when the model invents a non-SKU hint", async () => {
    const result = await executeLookupInventory({
      body: "יש לכם שטיחי צמר?",
      sku: "צמר",
      history: [],
    })
    assert.equal(result.ok, false)
  })
})
