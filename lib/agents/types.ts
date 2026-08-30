export const AGENT_IDS = ["master", "sales", "faq", "service"] as const
export type AgentId = (typeof AGENT_IDS)[number]

export const CONVERSATIONAL_ACTIONS = [
  "reply",
  "reset",
  "end",
  "faq",
  "sales",
  "service",
  "shipping",
  "human_sales",
  "human_service",
  "invoice_tax",
  "invoice_tax_receipt",
  "receipt",
] as const
export type ConversationalAction = (typeof CONVERSATIONAL_ACTIONS)[number]

export const MASTER_ACTIONS = [
  "ROUTE_TO_INFO_AGENT",
  "ROUTE_TO_SALES_AGENT",
  "ROUTE_TO_SERVICE_AGENT",
  "ROUTE_TO_SHIPPING_STATUS",
] as const
export type MasterAction = (typeof MASTER_ACTIONS)[number]

export type AgentAction = ConversationalAction | MasterAction

export const ACTIONS_BY_AGENT: Record<AgentId, readonly AgentAction[]> = {
  master: MASTER_ACTIONS,
  sales: [
    "reply",
    "reset",
    "end",
    "faq",
    "service",
    "shipping",
    "human_sales",
  ],
  faq: ["reply", "reset", "end", "sales", "service", "shipping"],
  service: [
    "reply",
    "reset",
    "end",
    "faq",
    "sales",
    "shipping",
    "human_service",
    "invoice_tax",
    "invoice_tax_receipt",
    "receipt",
  ],
}

export const SILENT_ACTIONS = new Set<AgentAction>([
  "reset",
  "end",
  "faq",
  "sales",
  "service",
  "shipping",
  "human_sales",
  "human_service",
  "invoice_tax",
  "invoice_tax_receipt",
  "receipt",
  ...MASTER_ACTIONS,
])

export const CUSTOMER_HEADER = "*הום בוט :)*"
export const CUSTOMER_NATURAL_CLOSE = "אם צריך עוד משהו — אני כאן."

export type HistoryMessage = {
  role: "user" | "assistant"
  content: string
}

export type AgentRequest = {
  conversationId: string
  body: string
}

export type TurnMetrics = {
  latency_ms?: number
  llm_calls?: number
  input_tokens?: number
  output_tokens?: number
  models_used?: string[]
  tier?: string | null
  profile?: string | null
  fallback_layer?: string | null
  routing_path?: string | null
}

export type AgentResponse = {
  ok: true
  agent: AgentId
  reply: string
  /** When set, each item is sent as a separate customer message (in order). */
  replies?: string[]
  action: AgentAction
  route?: AgentId[]
  metrics?: TurnMetrics
  /** True when outbound text was intentionally omitted (e.g. duplicate webhook). */
  duplicateSuppressed?: boolean
}

export const MASTER_ROUTE_MAP: Record<MasterAction, AgentId | "shipping"> = {
  ROUTE_TO_INFO_AGENT: "faq",
  ROUTE_TO_SALES_AGENT: "sales",
  ROUTE_TO_SERVICE_AGENT: "service",
  ROUTE_TO_SHIPPING_STATUS: "shipping",
}

export const SPECIALIST_IDS = ["faq", "sales", "service"] as const
export type SpecialistId = (typeof SPECIALIST_IDS)[number]

export function isSpecialistId(value: string): value is SpecialistId {
  return (SPECIALIST_IDS as readonly string[]).includes(value)
}
