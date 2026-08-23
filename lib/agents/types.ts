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

export type HistoryMessage = {
  role: "user" | "assistant"
  content: string
}

export type AgentRequest = {
  conversationId: string
  body: string
}

export type AgentResponse = {
  ok: true
  agent: AgentId
  reply: string
  action: AgentAction
}
