import { buildBranchReviewLinkReply } from "@/lib/agents/feedback-handling"
import type { HistoryMessage } from "@/lib/agents/types"

export function executeGetBranchReviewLink(input: {
  body: string
  history?: HistoryMessage[]
}) {
  const info = buildBranchReviewLinkReply(input.body, input.history ?? [])
  // Data-mode: give the model the verified review URL to weave into its own
  // reply instead of overriding it with a canned message.
  return {
    ok: true as const,
    reviewLinkInfo: info.trim(),
    note: "Verified Google review link data. Compose the reply yourself — copy the URL EXACTLY, never invent or alter review links.",
  }
}
