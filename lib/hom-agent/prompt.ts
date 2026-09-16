import { readFileSync } from "node:fs"
import { join } from "node:path"
import { selectFaqKb } from "@/lib/agents/kb"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const root = join(process.cwd(), "lib/hom-agent")

let cachedPrompt: string | null = null

/** Static JSON contract — kept adjacent to hom-bot.md for prompt-cache prefix stability. */
const FINAL_OUTPUT_BLOCK = `
### FINAL OUTPUT
After using tools when needed, respond with JSON only:
{ "reply": "<Hebrew customer message>", "action": "reply" | "human_sales" | "human_service" | "reset" | "end", "crm_department"?: "sales" | "service", "expects_reply"?: boolean }
Include crm_department only when department is 100% certain — omit otherwise.
Set expects_reply false when the reply ends with a warm resolution close (שמחתי לעזור היום! 😊) — never chase with עדיין כאן? or ask "אפשר לעזור במשהו נוסף?". Customer thanks after a resolved answer → action end with the same warm close.
Never leave reply empty on substantive turns.`

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
  /** Pre-rendered trainer rules section (see homAgentLearnedRulesSection). */
  learnedRules?: string | null
  /** Pre-rendered owner Q&A section (see ownerAnswersSection). */
  ownerAnswers?: string | null
}) {
  // Static prefix first (hom-bot + JSON contract) so Gateway/Anthropic prompt cache
  // can reuse the brain across turns; per-turn KB/hints/summary follow.
  const parts = [readHomBotPrompt(), FINAL_OUTPUT_BLOCK]

  parts.push("\n\n### VERIFIED KNOWLEDGE BASE\n")
  parts.push(selectFaqKb(input?.userText?.trim() ?? ""))

  if (input?.ownerAnswers?.trim()) {
    parts.push(`\n\n${input.ownerAnswers.trim()}`)
  }

  if (input?.learnedRules?.trim()) {
    parts.push(`\n\n${input.learnedRules.trim()}`)
  }

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

  return parts.join("")
}

/** Test helper: index of static FINAL OUTPUT block (must precede dynamic KB). */
export function homAgentFinalOutputIndex(prompt: string) {
  return prompt.indexOf("### FINAL OUTPUT")
}

/** Test helper: index of dynamic KB section (must follow static prefix). */
export function homAgentKbSectionIndex(prompt: string) {
  return prompt.indexOf("### VERIFIED KNOWLEDGE BASE")
}
