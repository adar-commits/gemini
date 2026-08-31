import { tool } from "ai"
import { z } from "zod"
import type { HistoryMessage } from "@/lib/agents/types"
import { executeLookupOrderStatus } from "@/lib/hom-agent/tools/order-status"
import { executeLookupInventory } from "@/lib/hom-agent/tools/inventory"
import { executeFetchDigitalDocument } from "@/lib/hom-agent/tools/document"
import { executeGetBranchInfo } from "@/lib/hom-agent/tools/branches"
import { executeGetBranchReviewLink } from "@/lib/hom-agent/tools/review-link"

export type HomAgentToolContext = {
  body: string
  phone?: string
  history: HistoryMessage[]
}

export function createHomAgentTools(context: HomAgentToolContext) {
  return {
    lookup_order_status: tool({
      description:
        "Live shipment/order status via Priority API. Use when customer asks where THEIR order/shipment is, or to confirm an order during service intake.",
      inputSchema: z.object({
        lookupHint: z
          .string()
          .optional()
          .describe("Optional order number or extra context from the customer message"),
      }),
      execute: async ({ lookupHint }) => {
        const body = lookupHint?.trim()
          ? `${context.body}\n${lookupHint}`.trim()
          : context.body
        return executeLookupOrderStatus({
          body,
          phone: context.phone,
          history: context.history,
        })
      },
    }),
    lookup_inventory: tool({
      description:
        "Branch stock for a SKU with hyphen (e.g. 40400025-200290). Use only when customer asks availability in stores.",
      inputSchema: z.object({
        sku: z.string().describe("Product SKU including hyphen"),
        branchHint: z.string().optional().describe("City or branch name filter"),
      }),
      execute: async ({ sku, branchHint }) =>
        executeLookupInventory({
          body: context.body,
          sku,
          branchHint,
          history: context.history,
        }),
    }),
    fetch_digital_document: tool({
      description:
        "Receipt or tax invoice PDF/link via Priority. Use when customer asks for קבלה / חשבונית.",
      inputSchema: z.object({
        documentHint: z
          .string()
          .optional()
          .describe("Receipt, invoice, order number if known"),
      }),
      execute: async ({ documentHint }) => {
        const body = documentHint?.trim()
          ? `${context.body}\n${documentHint}`.trim()
          : context.body
        return executeFetchDigitalDocument({
          body,
          phone: context.phone,
          history: context.history,
        })
      },
    }),
    get_branch_info: tool({
      description:
        "Branch addresses and hours. Use for branch list, hours, or where to return to a branch — NOT for Google review links.",
      inputSchema: z.object({
        query: z.string().describe("Customer question about branches"),
        returnContext: z
          .boolean()
          .optional()
          .describe("True when customer asks how/where to return to a branch"),
      }),
      execute: async ({ query, returnContext }) =>
        executeGetBranchInfo({ query, returnContext }),
    }),
    get_branch_review_link: tool({
      description:
        "Google writereview URL for a specific branch. Use ONLY when customer explicitly asks for review/rating link.",
      inputSchema: z.object({
        branchHint: z.string().describe("Branch name or city from customer message"),
      }),
      execute: async ({ branchHint }) =>
        executeGetBranchReviewLink({
          body: `${context.body}\n${branchHint}`.trim(),
          history: context.history,
        }),
    }),
  }
}

export type HomAgentTools = ReturnType<typeof createHomAgentTools>
