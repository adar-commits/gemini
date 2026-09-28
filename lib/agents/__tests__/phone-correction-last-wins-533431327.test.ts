import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { extractPhoneFromText, userProvidedPhone } from "@/lib/agents/order-lookup"

// 533431327: the customer typed a phone, then "סליחה <correct phone>". Landbot merged
// the burst into one turn and the lookup used the first (wrong) number.
const MERGED_BURST = "77677 0542337799 סליחה 0542337789"

describe("phone correction in a merged burst (533431327)", () => {
  it("uses the corrected (last) phone, not the first", () => {
    assert.equal(extractPhoneFromText(MERGED_BURST), "0542337789")
    assert.equal(userProvidedPhone(MERGED_BURST), "0542337789")
    assert.notEqual(extractPhoneFromText(MERGED_BURST), "0542337799")
  })

  it("single phone is unchanged", () => {
    assert.equal(extractPhoneFromText("סליחה 054-2337789"), "0542337789")
    assert.equal(extractPhoneFromText("0542337789"), "0542337789")
  })
})
