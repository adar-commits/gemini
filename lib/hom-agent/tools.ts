import { tool } from "ai"
import { z } from "zod"
import type { HistoryMessage } from "@/lib/agents/types"
import { executeLookupOrderStatus } from "@/lib/hom-agent/tools/order-status"
import { executeLookupInventory } from "@/lib/hom-agent/tools/inventory"
import { executeFetchDigitalDocument } from "@/lib/hom-agent/tools/document"
import { executeGetBranchInfo } from "@/lib/hom-agent/tools/branches"
import { executeGetBranchReviewLink } from "@/lib/hom-agent/tools/review-link"
import { executeGetCampaigns } from "@/lib/hom-agent/tools/campaigns"
import { executeCreateSwitchRequest } from "@/lib/hom-agent/tools/switch-request"

export type HomAgentToolContext = {
  body: string
  phone?: string
  history: HistoryMessage[]
}

export function createHomAgentTools(context: HomAgentToolContext) {
  return {
    lookup_order_status: tool({
      description:
        "Live shipment/order status via Priority API. Call when customer asks where THEIR order/shipment is, mid-service order confirm, or rejects a shown/identified order (אז זה לא זה) so the next unused order on that phone can be offered. Do NOT call for return-policy FAQ or hypothetical return eligibility (14 days, can I return on Sunday?) — answer those from KB.",
      inputSchema: z.object({
        lookupHint: z
          .string()
          .optional()
          .describe(
            "Order number, or the mobile from a payment image / the phone the customer wants searched. When they agree to look up by a phone you already named, pass that phone here."
          ),
      }),
      execute: async ({ lookupHint }) =>
        executeLookupOrderStatus({
          body: context.body,
          phone: context.phone,
          history: context.history,
          lookupHint: lookupHint?.trim() || undefined,
        }),
    }),
    lookup_inventory: tool({
      description:
        "Branch stock for a specific SKU with hyphen (e.g. 31503138-200290) that the customer provided. Never call for product-type/material/size browsing (e.g. wool carpets, large pouf) — those are KB + sales questions.",
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
    get_campaigns: tool({
      description:
        "Live active/expired promotions from Priority. Use when customer asks about מבצעים, הנחות, קופונים, קוד הנחה, or whether a specific campaign is still valid. Returns coupon_code when present — share only if campaign is active.",
      inputSchema: z.object({
        campaignHint: z
          .string()
          .optional()
          .describe('Specific campaign name to check, or omit / "all" for full list'),
      }),
      execute: async ({ campaignHint }) =>
        executeGetCampaigns({
          body: context.body,
          campaignHint,
        }),
    }),
    create_switch_request: tool({
      description:
        "Create an exchange (החלפה) switch request in Priority after dissatisfaction menu → customer chose החלפה → order confirmed → A/B/C quiz complete. Never for returns portal path, policy FAQ, defect/service, or new-purchase sales intake.",
      inputSchema: z.object({
        exchangeKind: z
          .enum(["same_model_color", "same_model_size", "different_model"])
          .describe("A=same model different color, B=same model/color different size, C=different model"),
        targetSku: z
          .string()
          .optional()
          .describe("Target SKU for kind A/B — optional if customer cannot find it"),
        reasonCode: z
          .enum(["changed_mind", "quality_insufficient", "different_from_website"])
          .optional()
          .describe("Required mapping for kind C — infer from customer reason text"),
        customerReasonText: z
          .string()
          .optional()
          .describe("Free-text reason for kind C — required before calling"),
      }),
      execute: async ({ exchangeKind, targetSku, reasonCode, customerReasonText }) =>
        executeCreateSwitchRequest({
          body: context.body,
          phone: context.phone,
          history: context.history,
          exchangeKind,
          targetSku,
          reasonCode,
          customerReasonText,
        }),
    }),
  }
}

export type HomAgentTools = ReturnType<typeof createHomAgentTools>
