import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import {
  ORDER_NUMBER_ASK_EXAMPLES,
  buildOrderConfirmationPrompt,
  buildOrderNumberRequestPrompt,
  customerOrderNumberStyleFromHistory,
  formatCustomerOrderNumber,
  type OrderShipmentStatus,
} from "@/lib/agents/order-lookup"

const shopifyOrder: OrderShipmentStatus = {
  orderNumber: "SO26076884",
  branchLabel: "אתר אינטרנט",
  statusCode: "1",
  statusLabel: "בטיפול",
  statusDescription: "",
  branchCode: null,
  totalPrice: 500,
  raw: { ORDNAME: "SO26076884", REFERENCE: "76884" },
}

describe("customer order number format", () => {
  it("uses concrete examples in ask prompts", () => {
    assert.match(ORDER_NUMBER_ASK_EXAMPLES, /SO26005938/)
    assert.match(ORDER_NUMBER_ASK_EXAMPLES, /#76884/)
    assert.doesNotMatch(ORDER_NUMBER_ASK_EXAMPLES, /5–8|SO…/)
    assert.match(buildOrderNumberRequestPrompt(), /SO26005938/)
    assert.match(buildOrderNumberRequestPrompt(), /#76884/)
  })

  it("detects hash style from customer message", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "הזamנה #76884", agent: null },
    ]
    assert.equal(customerOrderNumberStyleFromHistory(history), "hash")
  })

  it("keeps hash format in confirmation prompt", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "#76884", agent: null },
    ]
    const prompt = buildOrderConfirmationPrompt(shopifyOrder, history, "#76884")
    assert.match(prompt, /#76884/)
    assert.doesNotMatch(prompt, /SO26076884/)
  })

  it("keeps SO format when customer used SO", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "SO26005938", agent: null },
    ]
    const formatted = formatCustomerOrderNumber({
      orderNumber: "SO26005938",
      history,
    })
    assert.equal(formatted, "SO26005938")
  })
})
