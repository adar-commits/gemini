import { usesHomAgentV3 } from "@/lib/hom-agent/engine"
import { runHomAgentTurn } from "@/lib/hom-agent/run-turn"
import type { UserTurn } from "@/lib/agents/user-turn"
import type { AgentResponse } from "@/lib/agents/types"

/** Single entry for customer turns — v3 by default; v2 removed after cutover. */
export async function runCustomerConversation(
  conversationId: string,
  turn: UserTurn,
  options?: {
    customerName?: string
    preview?: boolean
    phone?: string
    priorityApiEnabled?: boolean
    onPriorityApiCall?: () => void | Promise<void>
    persistTurn?: boolean
  }
): Promise<AgentResponse> {
  if (!usesHomAgentV3()) {
    throw new Error(
      "AGENT_ENGINE=v2 is no longer available. Remove the env var or set AGENT_ENGINE=v3."
    )
  }
  return runHomAgentTurn(conversationId, turn, options)
}

/** @deprecated Use runCustomerConversation */
export const runMasterConversation = runCustomerConversation
