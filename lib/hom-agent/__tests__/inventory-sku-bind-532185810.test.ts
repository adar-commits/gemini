import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import { runStructuredInventoryPreTurn } from "@/lib/hom-agent/pre-turn"

const PRIORITY_INVENTORY_ROW = [
  {
    sku: "31503138-200290",
    preorder_reqdate: "2026-11-15",
    warehouses_inventory: [
      { warehouse: "מחסן פתח תקווה", warehouse_id: "120", quantity: 0 },
      { warehouse: "סניף אירפורט סיטי", warehouse_id: "20", quantity: 0 },
      { warehouse: 'סניף הלח"י בני ברק', warehouse_id: "90", quantity: 0 },
    ],
  },
]

const history = [
  { role: "user" as const, content: "יש במלאי בסניף בני ברק?" },
  {
    role: "assistant" as const,
    content:
      "*הום בוט :)*\nכדי לבדוק מלאי בסניף אני צריך את המק״ט של הדגם (לדוגמה: 31503138-200290).",
  },
]

const originalFetch = globalThis.fetch

describe("inventory SKU bind (532185810)", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("valid מק״ט after stock ask returns the Priority availability for that SKU", async () => {
    globalThis.fetch = async () => Response.json(PRIORITY_INVENTORY_ROW)

    const result = await runStructuredInventoryPreTurn({
      turn: { text: "31503138-200290", media: [] },
      history,
    })

    assert.equal(result.kind, "handled")
    assert.ok(result.kind === "handled" && result.reply.includes("31503138-200290"), String(result.reply))
    assert.ok(!result.reply?.includes("שלחו מק״ט"))
    assert.ok(!result.reply?.includes("אין לי אפשרות"))
  })
})
