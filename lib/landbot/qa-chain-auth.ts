import { isCronAuthorized } from "@/lib/agents/cron-auth"
import {
  cursorAutomationQaAnalyzeAuthToken,
} from "@/lib/landbot/cursor-automation-qa"

function bearerMatches(request: Request, expectedRaw: string | null | undefined) {
  const expected = expectedRaw?.trim().replace(/^Bearer\s+/i, "")
  if (!expected) return false
  const header = request.headers.get("authorization")?.trim() ?? ""
  const token = header.replace(/^Bearer\s+/i, "")
  return token === expected
}

/** Chain proxy: Vercel CRON_SECRET or the Analyze automation inbound webhook token. */
export function isQaChainAuthorized(request: Request) {
  if (isCronAuthorized(request)) return true
  return bearerMatches(request, cursorAutomationQaAnalyzeAuthToken())
}
