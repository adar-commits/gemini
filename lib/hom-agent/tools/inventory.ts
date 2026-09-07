import {
  extractSku,
  resolveBranchInventoryReply,
  shouldHandleBranchInventory,
} from "@/lib/agents/inventory-lookup"
import { isValidInventorySku } from "@/lib/agents/phone-for-api"
import type { HistoryMessage } from "@/lib/agents/types"

export async function executeLookupInventory(input: {
  body: string
  sku?: string
  branchHint?: string
  history?: HistoryMessage[]
}) {
  const history = input.history ?? []
  const query = [input.sku, input.branchHint, input.body].filter(Boolean).join(" ")
  const inventoryContext = shouldHandleBranchInventory(input.body, history)

  // No real מק״ט anywhere → this is product browsing, not a stock check.
  // Refuse before touching the Priority API so the model answers from KB.
  const skuCandidate =
    (input.sku?.trim() && isValidInventorySku(input.sku.trim()) ? input.sku.trim() : null) ??
    extractSku(query)
  if (!skuCandidate) {
    return {
      ok: false as const,
      errorCode: "inventory_misroute",
      error:
        "No valid מק״ט (SKU with hyphen, e.g. 31503138-200290) in the request — this is a product-type/browsing question. Answer from the KB and offer יועץ מכירות; ask for the מק״ט only if the customer wants branch stock for a specific product.",
    }
  }

  if (!inventoryContext) {
    return {
      ok: false as const,
      errorCode: "inventory_misroute",
      error:
        "Likely wrong tool call for this turn (no inventory context). Re-read intent and answer directly; use inventory lookup only for explicit stock checks.",
    }
  }

  try {
    const reply = await resolveBranchInventoryReply({
      body: query,
      history,
    })
    return { ok: true as const, reply: reply.trim() }
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Inventory lookup failed",
    }
  }
}
