import { readFileSync } from "node:fs"
import { join } from "node:path"
import { selectFaqKb } from "@/lib/agents/kb"

const root = join(process.cwd(), "lib/hom-agent")

let cachedPrompt: string | null = null

function readHomBotPrompt() {
  if (cachedPrompt) return cachedPrompt
  cachedPrompt = readFileSync(join(root, "prompts/hom-bot.md"), "utf8")
  return cachedPrompt
}

export function buildHomAgentSystemPrompt(input?: {
  sessionSummary?: string | null
  whatsappPhone?: string | null
  userText?: string | null
}) {
  const parts = [readHomBotPrompt()]

  parts.push("\n\n### VERIFIED KNOWLEDGE BASE\n")
  parts.push(selectFaqKb(input?.userText?.trim() ?? ""))

  if (input?.whatsappPhone?.trim()) {
    parts.push(
      `\n\n### CHANNEL CONTEXT\nWhatsApp phone for this chat: ${input.whatsappPhone.trim()}`
    )
  }

  if (input?.sessionSummary?.trim()) {
    parts.push(
      `\n\n### CONVERSATION SUMMARY (internal)\n${input.sessionSummary.trim()}`
    )
  }

  parts.push(`
### FINAL OUTPUT
After using tools when needed, respond with JSON only:
{ "reply": "<Hebrew customer message>", "action": "reply" | "human_sales" | "human_service" | "reset" | "end" }
Never leave reply empty on substantive turns.`)

  return parts.join("")
}
