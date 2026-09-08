import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  formatHebrewCustomerDate,
  formatHebrewCustomerDateTime,
  isoHasMeaningfulTime,
} from "@/lib/agents/hebrew-date-format"

describe("hebrew customer date format", () => {
  it("formats dates as dd/mm/yyyy", () => {
    assert.equal(formatHebrewCustomerDate("2026-09-05T00:00:00+03:00"), "05/09/2026")
    assert.equal(formatHebrewCustomerDate("2026-08-05"), "05/08/2026")
  })

  it("adds בשעה only when ISO carries a real clock time", () => {
    assert.equal(
      formatHebrewCustomerDateTime("2026-08-30T14:00:00+03:00"),
      "30/08/2026 בשעה 14:00"
    )
    assert.equal(
      formatHebrewCustomerDateTime("2026-09-05T00:00:00+03:00"),
      "05/09/2026"
    )
    assert.equal(formatHebrewCustomerDateTime("2026-08-05"), "05/08/2026")
  })

  it("does not treat UTC midnight as a meaningful time", () => {
    assert.equal(isoHasMeaningfulTime("2026-08-20T00:00:00Z"), false)
    assert.equal(formatHebrewCustomerDateTime("2026-08-20T00:00:00Z"), "20/08/2026")
  })
})
