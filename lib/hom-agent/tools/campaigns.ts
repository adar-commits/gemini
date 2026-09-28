import {
  isCampaignQuestion,
  resolveCampaignLookupReply,
} from "@/lib/agents/campaign-lookup"
import { CUSTOMER_HEADER, type HistoryMessage } from "@/lib/agents/types"

const STORE_VALIDITY_POLICY =
  "Website campaigns are valid in the branches too, unless the campaign's terms page (תקנון המבצע) on the site says otherwise."

const EXCHANGE_PRICE_POLICY =
  "Whether the sale price applies to an exchange or a later purchase depends on the campaign's terms page (תקנון המבצע). Do not promise a price — offer a sales advisor (human_sales) to confirm."

/** Status lines of the canned reply (without header / advisor offer), used to spot a re-send. */
function cannedStatusLines(reply: string) {
  return reply
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && line !== CUSTOMER_HEADER)
    .slice(1, -1)
}

function wasCannedReplyAlreadySent(reply: string, history: HistoryMessage[]) {
  const lines = cannedStatusLines(reply)
  if (lines.length === 0) return false
  return history.some(
    (message) =>
      message.role === "assistant" && lines.every((line) => message.content.includes(line))
  )
}

type CampaignToolInput = {
  body: string
  campaignHint?: string | null
  dataOnly?: boolean
  history?: HistoryMessage[]
}

export async function executeGetCampaigns(input: CampaignToolInput) {
  try {
    const reply = await resolveCampaignLookupReply(input)
    return buildCampaignToolResult(reply, input)
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Campaign lookup failed",
    }
  }
}

export function buildCampaignToolResult(reply: string, input: CampaignToolInput) {
  // The canned reply presumes the customer asked about promotions. Only let it
  // override the model's own composition when they actually did — otherwise
  // return the campaigns as background data the model may use or ignore.
  // A canned answer already sent in this thread is a follow-up: re-sending it
  // verbatim gets rewritten into "לא הצלחתי להבין" (479338963).
  if (input.dataOnly || wasCannedReplyAlreadySent(reply, input.history ?? [])) {
    return {
      ok: true as const,
      campaignsInfo: reply.trim(),
      storeValidity: STORE_VALIDITY_POLICY,
      exchangePricePolicy: EXCHANGE_PRICE_POLICY,
      note: "Answer the customer's actual question using this data — do not reply with a bare campaign-validity line, and never re-send a campaign answer already given in this thread.",
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
}
