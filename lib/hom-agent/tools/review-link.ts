import { buildBranchReviewLinkReply } from "@/lib/agents/feedback-handling"
import type { HistoryMessage } from "@/lib/agents/types"

export function executeGetBranchReviewLink(input: {
  body: string
  history?: HistoryMessage[]
}) {
  const reply = buildBranchReviewLinkReply(input.body, input.history ?? [])
  return { ok: true as const, reply: reply.trim() }
}
