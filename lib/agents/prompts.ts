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

const OFF_TOPIC_RULE = `
### OFF-TOPIC / UNRELATED MESSAGES
Never treat casual greetings or small-talk openers as off-topic (for example: שלום, היי, אהלן, מה נשמע, מה קורה, בוקר טוב). Use the Initial Welcome / greeting rule instead.

If the message is clearly unrelated to HoM GROUP business (שטיחים, פופים, אביזרי בית, רכישה, מחיר, מלאי, משלוח, החזרה, ביטול, סניפים, שעות, תקנון, תלונה, הזמנה, מסמכים) — for example general trivia, history, politics, homework, jokes, or random chat that does not fit the current service context — reply with action=reply and EXACTLY this customer text (header included):

*הום בוט :)*
לא הצלחתי להבין את השאלה, נסה שוב

Do not guess, do not answer the off-topic question, do not route silently, and do not use the unrelated-products deflection for these cases.
`

const UNCERTAINTY_RULE = `
### MID-CONVERSATION UNCERTAINTY
If you are mid-conversation and cannot determine the correct next step with confidence from KB + context, do NOT guess or loop.
Tell the customer you are referring the chat to the right department, then route:
• Policy / returns / branches / general info — "מחלקת שירות לקוחות" → action=service (or human_service if intake is complete and a human is appropriate)
• Purchase / product / price — "מחלקת מכירות" → action=sales (or human_sales when ready)
• Operational case needing a person — include one short handoff sentence and human_service / human_sales

Example line: "כדי להמשיך לטפל בפנייה בצורה מדויקת, אעביר את השיחה למחלקת שירות לקוחות לסיוע נוסף."
Always include customer-facing Hebrew text; never silent route when the customer is waiting for a reply.
`

const MEDIA_RULE = `
### CUSTOMER MEDIA (images / audio / video / documents)
When the customer sends images, use them only for the active flow (room photo for sales, damage photo for service). Do not invent product facts from an image.
When the customer sends audio or video and you cannot rely on it, ask briefly for a short text description or a photo instead.
Never claim you watched/listened if you did not understand the media.
`

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
    return `${readAgentFile("prompts/sales.md")}\n${OFF_TOPIC_RULE}\n${UNCERTAINTY_RULE}\n${MEDIA_RULE}\n${OUTPUT_CONTRACT}`
  }
  if (agent === "faq") {
    return `${readAgentFile("prompts/faq.md")}\n\n### VERIFIED KNOWLEDGE BASE\n${selectFaqKb(userText)}\n${OFF_TOPIC_RULE}\n${UNCERTAINTY_RULE}\n${OUTPUT_CONTRACT}`
  }
  return `${readAgentFile("prompts/service.md")}\n${OFF_TOPIC_RULE}\n${UNCERTAINTY_RULE}\n${MEDIA_RULE}\n${OUTPUT_CONTRACT}`
}
