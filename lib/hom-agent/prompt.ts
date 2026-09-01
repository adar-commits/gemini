import { readFileSync } from "node:fs"
import { join } from "node:path"
import { selectFaqKb } from "@/lib/agents/kb"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

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
  history?: HistoryMessage[]
}) {
  const parts = [readHomBotPrompt()]

  parts.push("\n\n### VERIFIED KNOWLEDGE BASE\n")
  parts.push(selectFaqKb(input?.userText?.trim() ?? ""))

  const hints =
    input?.history && input.userText != null
      ? buildConversationHints({
          history: input.history,
          body: input.userText,
          whatsappPhone: input.whatsappPhone ?? undefined,
        })
      : null
  if (hints) {
    parts.push("\n\n### THIS TURN — READ FIRST\n")
    parts.push(hints)
  }

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
