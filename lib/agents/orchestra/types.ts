import type { AgentId, MasterAction } from "@/lib/agents/types"

export const CONVERSATION_PHASES = [
  "opening",
  "discovery",
  "sales_intake",
  "policy_info",
  "product_specific",
  "shipping_tracking",
  "post_purchase_service",
  "handoff_pending",
  "dissatisfaction",
  "closing",
  "off_topic",
  "ambiguous",
] as const

export type ConversationPhase = (typeof CONVERSATION_PHASES)[number]

export type OrchestraEntities = {
  products: string[]
  spaces: string[]
  order_hints: string[]
  dates: string[]
  budget_hint: string | null
}

export type OrchestraTone = {
  frustration: 0 | 1 | 2 | 3
  urgency: 0 | 1 | 2 | 3
  style_hint: string
}

export type OrchestraRouteHint =
  | MasterAction
  | "faq"
  | "sales"
  | "service"
  | "shipping"
  | null

export type AdvisorPhaseResult = {
  phase: ConversationPhase
  phase_confidence: number
  phase_notes: string
}

export type AdvisorIntentResult = {
  recommended_route: OrchestraRouteHint
  route_confidence: number
  intent_summary: string
  stay_on_current: boolean
}

export type AdvisorRiskResult = {
  risks: string[]
  must_not_say: string[]
  kb_only_facts: boolean
}

export type AdvisorStrategyResult = {
  next_step: string
  ask_one_question: string | null
  escalate_human: boolean
}

export type OrchestraResult = {
  enabled: boolean
  skipped: boolean
  skip_reason?: string
  elapsed_ms: number
  deterministic: {
    phase: ConversationPhase
    entities: OrchestraEntities
    route_hint: OrchestraRouteHint
  }
  phase: AdvisorPhaseResult
  intent: AdvisorIntentResult
  risk: AdvisorRiskResult
  strategy: AdvisorStrategyResult
}

export type OrchestraContext = {
  body: string
  history: Array<{ role: "user" | "assistant"; content: string }>
  lastAgent: AgentId | null
  lastAction: string | null
  userTurnCount: number
  customerName?: string
}
