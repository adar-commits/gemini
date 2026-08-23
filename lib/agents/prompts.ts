import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { AgentId } from "@/lib/agents/types"

const root = join(process.cwd(), "lib/agents")

function readAgentFile(relativePath: string) {
  return readFileSync(join(root, relativePath), "utf8")
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

export function getSystemPrompt(agent: AgentId) {
  if (agent === "master") {
    return `${readAgentFile("prompts/master.md")}\n${OUTPUT_CONTRACT}`
  }
  if (agent === "sales") {
    return `${readAgentFile("prompts/sales.md")}\n${OUTPUT_CONTRACT}`
  }
  if (agent === "faq") {
    return `${readAgentFile("prompts/faq.md")}\n\n### VERIFIED KNOWLEDGE BASE\n${readAgentFile("kb/faq.md")}\n${OUTPUT_CONTRACT}`
  }
  return `${readAgentFile("prompts/service.md")}\n${OUTPUT_CONTRACT}`
}
