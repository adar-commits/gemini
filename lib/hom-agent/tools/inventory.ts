import { extractSku, resolveBranchInventoryReply } from "@/lib/agents/inventory-lookup"
import { isValidInventorySku } from "@/lib/agents/phone-for-api"
import type { HistoryMessage } from "@/lib/agents/types"

export async function executeLookupInventory(input: {
  body: string
  sku?: string
  branchHint?: string
  history?: HistoryMessage[]
}) {
  const query = [input.sku, input.branchHint, input.body].filter(Boolean).join(" ")

  // No real מק״ט anywhere → this is product browsing, not a stock check.
  // Refuse before touching the Priority API so the model answers from KB.
  const skuCandidate =
    (input.sku?.trim() && isValidInventorySku(input.sku.trim()) ? input.sku.trim() : null) ??
    extractSku(query)
  if (!skuCandidate) {
    return {
      ok: false as const,
      error:
        "No valid מק״ט (SKU with hyphen, e.g. 31503138-200290) in the request — this is a product-type/browsing question. Answer from the KB and offer יועץ מכירות; ask for the מק״ט only if the customer wants branch stock for a specific product.",
    }
  }

  try {
    const reply = await resolveBranchInventoryReply({
      body: query,
      history: input.history ?? [],
    })
    return { ok: true as const, reply: reply.trim() }
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Inventory lookup failed",
    }
  }
}
