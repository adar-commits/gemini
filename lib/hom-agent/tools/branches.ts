import { buildBranchReplyForText } from "@/lib/agents/branches"

export function executeGetBranchInfo(input: {
  query: string
  returnContext?: boolean
}) {
  const info = buildBranchReplyForText(input.query, {
    returnContext: input.returnContext ?? false,
  })
  // Data-mode: branch facts for the model to compose from — not a canned reply.
  // The model can answer the actual question (e.g. only the branch they asked
  // about) instead of dumping a fixed list.
  return {
    ok: true as const,
    branchesInfo: info.trim(),
    note: "Verified branch data. Compose the reply yourself: answer only what the customer asked, copy addresses, hours, and phone numbers EXACTLY as written.",
  }
}
