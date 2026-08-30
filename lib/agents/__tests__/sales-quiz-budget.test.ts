import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import { extractOrderReference } from "@/lib/agents/order-lookup"
import {
  blocksOrderLookupForSalesConsultation,
  isAwaitingSalesIntakeAnswer,
  isLikelyBudgetIntakeAnswer,
  shouldUseSalesIntakeFastPath,
} from "@/lib/agents/sales-intake"

const budgetQuestion = "*הום בוט :)*\nומה התקציב המשוער?"

describe("sales quiz budget answer", () => {
  const history: HistoryMessage[] = [
    {
      role: "assistant",
      content: budgetQuestion,
      agent: "sales",
    },
  ]

  it("detects awaiting budget answer", () => {
    assert.equal(isAwaitingSalesIntakeAnswer(history), true)
    assert.equal(isLikelyBudgetIntakeAnswer("2000"), true)
    assert.equal(isLikelyBudgetIntakeAnswer("עד 1,500 ש״ח"), true)
  })

  it("does not treat budget digits as an order reference", () => {
    assert.equal(extractOrderReference("2000", history), null)
    assert.equal(extractOrderReference("1500", history), null)
  })

  it("blocks order lookup during budget answer even when last agent was master", () => {
    assert.equal(
      blocksOrderLookupForSalesConsultation("2000", history, "master"),
      true
    )
  })

  it("keeps LLM mode on sales fast path for budget reply", () => {
    assert.equal(shouldUseSalesIntakeFastPath("2000", history, "master"), true)
  })
})
