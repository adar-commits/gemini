import { buildBranchReplyForText } from "@/lib/agents/branches"

export function executeGetBranchInfo(input: {
  query: string
  returnContext?: boolean
}) {
  const reply = buildBranchReplyForText(input.query, {
    returnContext: input.returnContext ?? false,
  })
  return { ok: true as const, reply: reply.trim() }
}
