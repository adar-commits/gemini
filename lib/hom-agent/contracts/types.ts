import type { HistoryMessage } from "@/lib/agents/types"
import type { HomAgentAction } from "@/lib/hom-agent/output-schema"

export type ContractSource = {
  phone?: string
  session?: string
  landbotId?: string
}

export type PreTurnHandler =
  | "guards"
  | "kb_faq"
  | "document"
  | "order"
  | "return_options"
  | "sales_intake"

export type PreTurnAssertion = {
  type: "preTurn"
  handler: PreTurnHandler
  expect: "handled" | "skip"
  action?: HomAgentAction
  replyMustInclude?: string[]
  replyMustNotInclude?: string[]
}

export type HintsAssertion = {
  type: "hints"
  hintMustMatch?: string[]
  hintMustNotMatch?: string[]
}

export type ClassifierAssertion = {
  type: "classifier"
  /** Dotted export name resolved in replay.ts */
  name: string
  args?: string[]
  expect: boolean
}

export type CoerceAssertion = {
  type: "coerce"
  inputAction: "human_service" | "human_sales"
  expectAction: HomAgentAction
}

export type CrmAssertion = {
  type: "crm"
  department: "sales" | "service"
  source?: "structured" | "llm"
  llmDepartment?: "sales" | "service" | null
}

export type DocumentFlowAssertion = {
  type: "documentFlow"
  name: string
  expect: boolean
}

export type ContractAssertion =
  | PreTurnAssertion
  | HintsAssertion
  | ClassifierAssertion
  | CoerceAssertion
  | CrmAssertion
  | DocumentFlowAssertion

export type ConversationContract = {
  id: string
  description?: string
  source?: ContractSource
  history: HistoryMessage[]
  turn: {
    text: string
    phone?: string
  }
  assertions: ContractAssertion[]
  /** Optional recorded LLM outcome — asserted when snapshotMode is on. */
  snapshot?: {
    action: HomAgentAction
    replyMustInclude?: string[]
    replyMustNotInclude?: string[]
  }
}

export type ContractReplayFailure = {
  contractId: string
  assertionIndex: number
  message: string
}

export type ContractReplayResult = {
  contractId: string
  ok: boolean
  failures: ContractReplayFailure[]
}
