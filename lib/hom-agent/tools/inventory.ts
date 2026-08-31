import { resolveBranchInventoryReply } from "@/lib/agents/inventory-lookup"
import type { HistoryMessage } from "@/lib/agents/types"

export async function executeLookupInventory(input: {
  body: string
  sku?: string
  branchHint?: string
  history?: HistoryMessage[]
}) {
  const query = [input.sku, input.branchHint, input.body].filter(Boolean).join(" ")
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
