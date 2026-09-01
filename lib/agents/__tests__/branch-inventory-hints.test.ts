import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  extractBranchCityFromInventoryQuery,
  isNoiseBranchCityHint,
  isOtherBranchesInventoryRequest,
} from "@/lib/agents/branches"

describe("inventory branch hints", () => {
  it("detects other-branches follow-ups", () => {
    assert.equal(isOtherBranchesInventoryRequest("יש בסניפים אחרים?"), true)
    assert.equal(isOtherBranchesInventoryRequest("בכל הסניפים"), true)
    assert.equal(isOtherBranchesInventoryRequest("בסניף נתניה"), false)
  })

  it("rejects noise branch captures like יש", () => {
    assert.equal(isNoiseBranchCityHint("יש"), true)
    assert.equal(isNoiseBranchCityHint("אחרים"), true)
    assert.equal(extractBranchCityFromInventoryQuery("בסניף יש?"), null)
    assert.equal(extractBranchCityFromInventoryQuery("בסניף נתניה"), "נתניה")
  })
})
