import { resolveCampaignLookupReply } from "@/lib/agents/campaign-lookup"

export async function executeGetCampaigns(input: {
  body: string
  campaignHint?: string | null
}) {
  try {
    const reply = await resolveCampaignLookupReply(input)
    return { ok: true as const, reply: reply.trim() }
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Campaign lookup failed",
    }
  }
}
