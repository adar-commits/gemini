import { readFileSync } from "node:fs"
import { join } from "node:path"
import { selectFaqKb } from "@/lib/agents/kb"
import { getBoundOrchestraDecision } from "@/lib/agent-core/config"
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

const INTENT_DECODER = () => readAgentFile("prompts/_intent-decoder.md")
const SHARED_FRAMEWORK = () => readAgentFile("prompts/_framework.md")

const OUTPUT_CONTRACT = `
### MACHINE OUTPUT CONTRACT
Return a JSON object with exactly:
- action: one of the allowed action values for this agent
- reply: customer-facing Hebrew text, or an empty string for silent actions

Silent actions must have reply="" and must not include the header.
Customer-facing replies for sales/faq/service must start with:
*הום בוט :)*
then a single newline and the message.
Use first person singular (I) in Hebrew — אני מבין / אני רואה / אעביר — never team voice (אנחנו, מבינים, רואים, נעביר).
`

const MASTER_OUTPUT_CONTRACT = `
### MACHINE OUTPUT CONTRACT
Return a JSON object with exactly:
- action: one of ROUTE_TO_INFO_AGENT, ROUTE_TO_SALES_AGENT, ROUTE_TO_SERVICE_AGENT, ROUTE_TO_SHIPPING_STATUS
Do not write customer-facing text.
`

export function getSystemPrompt(agent: AgentId, userText = "") {
  if (agent === "master") {
    return `${readAgentFile("prompts/master.md")}\n${INTENT_DECODER()}\n${MASTER_OUTPUT_CONTRACT}`
  }

  const shared = `${SHARED_FRAMEWORK()}\n${INTENT_DECODER()}`

  if (agent === "sales") {
    return `${readAgentFile("prompts/sales.md")}\n${shared}\n${OUTPUT_CONTRACT}`
  }
  if (agent === "faq") {
    const tier = getBoundOrchestraDecision()?.tier ?? null
    return `${readAgentFile("prompts/faq.md")}\n\n### VERIFIED KNOWLEDGE BASE\n${selectFaqKb(userText, tier)}\n${shared}\n${OUTPUT_CONTRACT}`
  }
  return `${readAgentFile("prompts/service.md")}\n${shared}\n${OUTPUT_CONTRACT}`
}
