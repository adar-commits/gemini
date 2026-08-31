import { buildHomAgentSystemPrompt } from "@/lib/hom-agent/prompt"
import type { AgentId } from "@/lib/agents/types"

/** @deprecated v3 uses hom-bot.md — kept for multi-question helper only. */
export function getSystemPrompt(agent: AgentId, _userText = "") {
  if (agent === "faq") {
    return buildHomAgentSystemPrompt()
  }
  throw new Error(`Specialist prompt for "${agent}" removed in v3 — use runCustomerConversation()`)
}
