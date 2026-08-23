import { readFileSync } from "node:fs"
import { join } from "node:path"
import { selectFaqKb } from "@/lib/agents/kb"
import type { AgentId } from "@/lib/agents/types"

const root = join(process.cwd(), "lib/agents")
const fileCache = new Map<string, string>()

function readAgentFile(relativePath: string) {
  const cached = fileCache.get(relativePath)
  if (cached) return cached
  const text = readFileSync(join(root, relativePath), "utf8")
  fileCache.set(relativePath, text)
  return text
}

const OUTPUT_CONTRACT = `
### MACHINE OUTPUT CONTRACT
Return a JSON object with exactly:
- action: one of the allowed action values for this agent
- reply: customer-facing Hebrew text, or an empty string for silent actions

Silent actions must have reply="" and must not include the header.
Customer-facing replies for sales/faq/service must start with:
*הום בוט :)*
then a single newline and the message.
`

const MASTER_OUTPUT_CONTRACT = `
### MACHINE OUTPUT CONTRACT
Return a JSON object with exactly:
- action: one of ROUTE_TO_INFO_AGENT, ROUTE_TO_SALES_AGENT, ROUTE_TO_SERVICE_AGENT, ROUTE_TO_SHIPPING_STATUS
Do not write customer-facing text.
`

export function getSystemPrompt(agent: AgentId, userText = "") {
  if (agent === "master") {
    return `${readAgentFile("prompts/master.md")}\n${MASTER_OUTPUT_CONTRACT}`
  }
  if (agent === "sales") {
    return `${readAgentFile("prompts/sales.md")}\n${OUTPUT_CONTRACT}`
  }
  if (agent === "faq") {
    return `${readAgentFile("prompts/faq.md")}\n\n### VERIFIED KNOWLEDGE BASE\n${selectFaqKb(userText)}\n${OUTPUT_CONTRACT}`
  }
  return `${readAgentFile("prompts/service.md")}\n${OUTPUT_CONTRACT}`
}
