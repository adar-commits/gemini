import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import { isBranchInventoryQuestion } from "@/lib/agents/inventory-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"

/** 431273377 — VENUS sales intake; customer pivots to branch stock instead of room answer. */
describe("sales branch stock pivot 431273377", () => {
  const history: HistoryMessage[] = [
    {
      role: "user",
      content: "היי אשמח לפרטים נוספים לגבי שטיח ונוס קרם-אפור VENUS",
      agent: null,
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* היי עדית! בשמחה, ונוס קרם-אפור זו בחירה יפה. כדי שיועץ המכירות יוכל לתת לך את כל הפרטים ולהתאים לך את המידה הנכונה, אשאל קודם כמה שאלות קצרות. לאיזה חלל השטיח מיועד? (סלון, חדר שינה, חדר ילדים או משהו אחר)",
      agent: "faq",
    },
  ]

  const body = "באיזה חנות יש במלאי לקנות היום"

  it("detects branch stock ask with חנות singular", () => {
    assert.equal(isBranchInventoryQuestion(body), true)
  })

  it("hints stock pivot and suppresses sales intake quiz", () => {
    const hints = buildConversationHints({
      history,
      body,
      whatsappPhone: "+972500000000",
    })
    assert.match(hints!, /431273377/)
    assert.match(hints!, /SALES \+ BRANCH STOCK PIVOT/)
    assert.match(hints!, /lookup_inventory/)
    assert.match(hints!, /never `human_sales` until lookup runs/i)
    assert.doesNotMatch(hints!, /SALES INTAKE QUIZ/)
  })
})
