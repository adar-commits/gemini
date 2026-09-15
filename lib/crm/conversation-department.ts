import { findCrmConversation } from "@/lib/crm/conversation-lookup"
import { getAgentSupabase } from "@/lib/agents/supabase"
import { isServiceOrderIdentificationFlow } from "@/lib/agents/order-lookup"
import { hasOngoingSalesIntake } from "@/lib/agents/sales-intake"
import {
  isPostPurchaseServiceFlow,
  isReturnPickupAwaitingThread,
  isServiceHandoffSummaryPending,
} from "@/lib/agents/service-intake"
import type { HistoryMessage } from "@/lib/agents/types"
import type { CrmDepartmentSlug } from "@/lib/hom-agent/output-schema"

export type CrmDepartment = "מכירות" | "שירות לקוחות"

export type HandoffAction = "human_sales" | "human_service"

export type CrmDepartmentSource = "handoff" | "llm" | "structured"

const CRM_DEPARTMENT_BY_ACTION: Record<HandoffAction, CrmDepartment> = {
  human_sales: "מכירות",
  human_service: "שירות לקוחות",
}

const CRM_DEPARTMENT_BY_SLUG: Record<CrmDepartmentSlug, CrmDepartment> = {
  sales: "מכירות",
  service: "שירות לקוחות",
}

const DEFAULT_INQUIRY_TYPE_BY_DEPARTMENT: Partial<Record<CrmDepartment, string>> = {
  מכירות: "sales_lead",
}

export function crmDepartmentForHandoff(action: HandoffAction): CrmDepartment {
  return CRM_DEPARTMENT_BY_ACTION[action]
}

export function crmDepartmentSlugToLabel(slug: CrmDepartmentSlug): CrmDepartment {
  return CRM_DEPARTMENT_BY_SLUG[slug]
}

export function crmDepartmentSyncEnabled() {
  return process.env.CRM_DEPARTMENT_SYNC?.trim() !== "false"
}

export type SetCrmDepartmentResult =
  | {
      ok: true
      updated: true
      sessionId: string
      department: CrmDepartment
      previousDepartment: string | null
    }
  | {
      ok: true
      updated: false
      reason: "disabled" | "not_found" | "unchanged"
    }

function structuredServiceDepartmentActive(
  history: HistoryMessage[],
  body: string
) {
  return (
    isServiceHandoffSummaryPending(history) ||
    isServiceOrderIdentificationFlow(history, body) ||
    isReturnPickupAwaitingThread(history, body) ||
    isPostPurchaseServiceFlow(history)
  )
}

export function resolveCrmDepartmentForTurn(input: {
  llmDepartment?: CrmDepartmentSlug | null
  history: HistoryMessage[]
  body: string
}): { department: CrmDepartmentSlug; source: Exclude<CrmDepartmentSource, "handoff"> } | null {
  if (input.llmDepartment) {
    return { department: input.llmDepartment, source: "llm" }
  }

  if (structuredServiceDepartmentActive(input.history, input.body)) {
    return { department: "service", source: "structured" }
  }

  if (hasOngoingSalesIntake(input.history)) {
    return { department: "sales", source: "structured" }
  }

  return null
}

/**
 * Set CRM inbox department on conversations — independent of Landbot assign.
 * Looks up by landbot_customer_id / session_id / conversation_ref.
 */
export async function setCrmConversationDepartment(input: {
  conversationId: string
  department: CrmDepartment
  source: CrmDepartmentSource
  handoffAction?: HandoffAction
}): Promise<SetCrmDepartmentResult> {
  if (!crmDepartmentSyncEnabled()) {
    return { ok: true, updated: false, reason: "disabled" }
  }

  const department = input.department
  const row = await findCrmConversation(input.conversationId)
  if (!row?.session_id) {
    console.warn("[crm-department] conversation not found", input.conversationId)
    return { ok: true, updated: false, reason: "not_found" }
  }

  const previousDepartment =
    typeof row.department === "string" ? row.department.trim() : null
  if (previousDepartment === department) {
    return { ok: true, updated: false, reason: "unchanged" }
  }

  const supabase = getAgentSupabase()
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {
    department,
    updated_at: now,
  }

  if (department === "מכירות") {
    patch.buying_intent = true
  }

  const inquiryType = DEFAULT_INQUIRY_TYPE_BY_DEPARTMENT[department]
  if (inquiryType && !row.inquiry_type) {
    patch.inquiry_type = inquiryType
  }

  const { error: updateError } = await supabase
    .from("conversations")
    .update(patch)
    .eq("session_id", row.session_id)

  if (updateError) throw updateError

  const { error: logError } = await supabase.from("conversation_status_log").insert({
    session_id: row.session_id,
    action_type: "department_set",
    old_value: previousDepartment,
    new_value: department,
    source: "hom_bot",
    changed_at: now,
    payload: {
      source: input.source,
      handoff_action: input.handoffAction ?? null,
      landbot_customer_id: row.landbot_customer_id ?? input.conversationId,
    },
  })

  if (logError) {
    console.warn("[crm-department] audit log failed", row.session_id, logError.message)
  }

  return {
    ok: true,
    updated: true,
    sessionId: row.session_id,
    department,
    previousDepartment,
  }
}

export async function setCrmConversationDepartmentForHandoff(input: {
  conversationId: string
  action: HandoffAction
}): Promise<SetCrmDepartmentResult> {
  return setCrmConversationDepartment({
    conversationId: input.conversationId,
    department: crmDepartmentForHandoff(input.action),
    source: "handoff",
    handoffAction: input.action,
  })
}

/** Service inactivity ping+close applies to שירות לקוחות and unset CRM department — not מכירות. */
export function crmDepartmentAllowsServiceInactivity(
  department: string | null | undefined
) {
  const normalized =
    typeof department === "string" ? department.trim() : ""
  if (!normalized) return true
  if (normalized === "מכירות") return false
  return normalized === "שירות לקוחות"
}

export async function crmConversationAllowsServiceInactivity(
  conversationId: string
) {
  const row = await findCrmConversation(conversationId)
  if (row?.closed_at) return false
  const department =
    typeof row?.department === "string" ? row.department.trim() : null
  return crmDepartmentAllowsServiceInactivity(department)
}

export async function maybeSyncCrmDepartmentFromTurn(input: {
  conversationId: string
  llmDepartment?: CrmDepartmentSlug | null
  history: HistoryMessage[]
  body: string
}): Promise<SetCrmDepartmentResult | null> {
  const resolved = resolveCrmDepartmentForTurn({
    llmDepartment: input.llmDepartment,
    history: input.history,
    body: input.body,
  })
  if (!resolved) return null

  const result = await setCrmConversationDepartment({
    conversationId: input.conversationId,
    department: crmDepartmentSlugToLabel(resolved.department),
    source: resolved.source,
  })

  if (result.ok && result.updated) {
    console.log("[crm-department] early sync", {
      conversationId: input.conversationId,
      department: result.department,
      source: resolved.source,
    })
  }

  return result
}
