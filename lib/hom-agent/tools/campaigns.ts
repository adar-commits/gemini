import {
  isCampaignQuestion,
  resolveCampaignLookupReply,
} from "@/lib/agents/campaign-lookup"

const STORE_VALIDITY_POLICY =
  "Website campaigns are valid in the branches too, unless the campaign's terms page (תקנון המבצע) on the site says otherwise."

export async function executeGetCampaigns(input: {
  body: string
  campaignHint?: string | null
}) {
  try {
    const reply = await resolveCampaignLookupReply(input)

    // The canned reply presumes the customer asked about promotions. Only let it
    // override the model's own composition when they actually did — otherwise
    // return the campaigns as background data the model may use or ignore.
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
