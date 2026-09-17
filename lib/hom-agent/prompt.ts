import { selectFaqKb, selectFaqKbAsync } from "@/lib/agents/kb"
import type { ModelTier } from "@/lib/agent-core/model-orchestra"
import { buildHomBotPrompt } from "@/lib/hom-agent/hom-bot-prompt"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

/** Static JSON contract — kept adjacent to hom-bot core for prompt-cache prefix stability. */
const FINAL_OUTPUT_BLOCK = `
### FINAL OUTPUT
After using tools when needed, respond with JSON only:
{ "reply": "<Hebrew customer message>", "action": "reply" | "human_sales" | "human_service" | "reset" | "end", "crm_department"?: "sales" | "service", "expects_reply"?: boolean }
Include crm_department only when department is 100% certain — omit otherwise.
Set expects_reply false when the reply ends with a warm resolution close (שמחתי לעזור היום! 😊) — never chase with עדיין כאן? or ask "אפשר לעזור במשהו נוסף?". Customer thanks after a resolved answer → action end with the same warm close.
Never leave reply empty on substantive turns.`

export type HomAgentPromptInput = {
  sessionSummary?: string | null
  whatsappPhone?: string | null
  userText?: string | null
  history?: HistoryMessage[]
  learnedRules?: string | null
  ownerAnswers?: string | null
  modelTier?: ModelTier | null
  /** LLM-first turn — keep full routing playbook in static prefix. */
  llmOwnsIntent?: boolean
}

function appendDynamicSections(parts: string[], input?: HomAgentPromptInput) {
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
}

function homBotInput(input?: HomAgentPromptInput) {
  return {
    history: input?.history,
    userText: input?.userText,
    modelTier: input?.modelTier,
    llmOwnsIntent: input?.llmOwnsIntent,
  }
}

export async function buildHomAgentSystemPromptAsync(input?: HomAgentPromptInput) {
  const parts = [buildHomBotPrompt(homBotInput(input)), FINAL_OUTPUT_BLOCK]

  parts.push("\n\n### VERIFIED KNOWLEDGE BASE\n")
  parts.push(await selectFaqKbAsync(input?.userText?.trim() ?? "", input?.modelTier ?? null))

  appendDynamicSections(parts, input)
  return parts.join("")
}

/** Sync path for tests — regex KB slice without async RAG fetch. */
export function buildHomAgentSystemPrompt(input?: HomAgentPromptInput) {
  const parts = [buildHomBotPrompt(homBotInput(input)), FINAL_OUTPUT_BLOCK]

  parts.push("\n\n### VERIFIED KNOWLEDGE BASE\n")
  parts.push(selectFaqKb(input?.userText?.trim() ?? "", input?.modelTier ?? null))

  appendDynamicSections(parts, input)
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
