import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  countBackInStockAlertRequests,
  isBackInStockAlertRequest,
} from "@/lib/agents/inventory-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { mergeTurns, summarizeTurn } from "@/lib/agents/user-turn"

const BUNNY =
  "היי, אשמח לקבל עדכון כשהמידה L - 160*230 של שטיח באני אפור BUNNY חוזרת למלאי"
const SHAGI =
  "היי, אשמח לקבל עדכון כשהמידה L - 160*230 של שטיח שאגי קטיפה פארמה 02 אפור SHAGI חוזרת למלאי"

// 534009436: two restock-alert lines in one burst — bot must recap both before human_sales.
describe("multi restock alert 534009436", () => {
  it("detects each line as a back-in-stock alert request", () => {
    assert.equal(isBackInStockAlertRequest(BUNNY), true)
    assert.equal(isBackInStockAlertRequest(SHAGI), true)
  })

  it("merged burst body counts two distinct restock alerts", () => {
    const merged = mergeTurns([
      { text: BUNNY, media: [] },
      { text: SHAGI, media: [] },
    ])
    const body = summarizeTurn(merged)
    assert.equal(countBackInStockAlertRequests(body), 2)
  })

  it("hints require listing every product in sales handoff summary", () => {
    const merged = mergeTurns([
      { text: BUNNY, media: [] },
      { text: SHAGI, media: [] },
    ])
    const body = summarizeTurn(merged)
    const hints = buildConversationHints({ history: [], body }) ?? ""
    assert.match(hints, /534009436/)
    assert.match(hints, /every/i)
    assert.match(hints, /human_sales/)
  })
})
