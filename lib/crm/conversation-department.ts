import { getAgentSupabase } from "@/lib/agents/supabase"

export type CrmDepartment = "מכירות" | "שירות לקוחות"

export type HandoffAction = "human_sales" | "human_service"

const CRM_DEPARTMENT_BY_ACTION: Record<HandoffAction, CrmDepartment> = {
  human_sales: "מכירות",
  human_service: "שירות לקוחות",
}

const DEFAULT_INQUIRY_TYPE_BY_ACTION: Partial<Record<HandoffAction, string>> = {
  human_sales: "sales_lead",
}

export function crmDepartmentForHandoff(action: HandoffAction): CrmDepartment {
  return CRM_DEPARTMENT_BY_ACTION[action]
}

export function crmDepartmentSyncEnabled() {
  return process.env.CRM_DEPARTMENT_SYNC?.trim() !== "false"
}

function safeConversationLookupId(conversationId: string) {
  return conversationId.trim().replace(/[^\dA-Za-z_-]/g, "")
}

async function findCrmConversation(conversationId: string) {
  const lookupId = safeConversationLookupId(conversationId)
  if (!lookupId) return null

  const supabase = getAgentSupabase()
  const { data, error } = await supabase
    .from("conversations")
    .select("session_id, department, inquiry_type, landbot_customer_id")
    .or(
      `landbot_customer_id.eq.${lookupId},session_id.eq.${lookupId},conversation_ref.eq.${lookupId}`
    )
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data
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

/**
 * Set CRM inbox department on conversations — independent of Landbot assign.
 * Looks up by landbot_customer_id / session_id / conversation_ref.
 */
export async function setCrmConversationDepartment(input: {
  conversationId: string
  action: HandoffAction
}): Promise<SetCrmDepartmentResult> {
  if (!crmDepartmentSyncEnabled()) {
    return { ok: true, updated: false, reason: "disabled" }
  }

  const department = crmDepartmentForHandoff(input.action)
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

  if (input.action === "human_sales") {
    patch.buying_intent = true
  }

  const inquiryType = DEFAULT_INQUIRY_TYPE_BY_ACTION[input.action]
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
      handoff_action: input.action,
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
