import {
  isCampaignQuestion,
  resolveCampaignLookupReply,
} from "@/lib/agents/campaign-lookup"

const STORE_VALIDITY_POLICY =
  "Website campaigns are valid in the branches too, unless the campaign's terms page (תקנון המבצע) on the site says otherwise."

const EXCHANGE_PRICE_POLICY =
  "Whether the sale price applies to an exchange or a later purchase depends on the campaign's terms page (תקנון המבצע). Do not promise a price — offer a sales advisor (human_sales) to confirm."

export async function executeGetCampaigns(input: {
  body: string
  campaignHint?: string | null
  dataOnly?: boolean
}) {
  try {
    const reply = await resolveCampaignLookupReply(input)

    // The canned reply presumes the customer asked about promotions. Only let it
    // override the model's own composition when they actually did — otherwise
    // return the campaigns as background data the model may use or ignore.
    if (input.dataOnly) {
      return {
        ok: true as const,
        campaignsInfo: reply.trim(),
        storeValidity: STORE_VALIDITY_POLICY,
        exchangePricePolicy: EXCHANGE_PRICE_POLICY,
        note: "Answer the customer's actual question using this data — do not reply with a bare campaign-validity line.",
      }
    }
    if (isCampaignQuestion(input.body)) {
      return { ok: true as const, reply: reply.trim(), storeValidity: STORE_VALIDITY_POLICY }
    }
    return {
      ok: true as const,
      campaignsInfo: reply.trim(),
      storeValidity: STORE_VALIDITY_POLICY,
      note: "Customer did NOT ask about promotions — do not pitch campaigns unless clearly relevant. Answer their actual message.",
    }
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Campaign lookup failed",
    }
  }
}
