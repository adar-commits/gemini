import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { getAgentSupabase } from "@/lib/agents/supabase"
import { isKbSelfServiceFaqThisTurn } from "@/lib/agents/kb-self-service-faq"
import {
  isActiveDigitalDocumentFlow,
  isDigitalDocumentRequest,
} from "@/lib/agents/digital-document-flow"
import { isShippingStatusQuestion } from "@/lib/agents/shipping"
import { classifyPostPurchaseCase } from "@/lib/agents/inquiry-intent"
import type { HistoryMessage } from "@/lib/agents/types"
import type { ConversationContract } from "@/lib/hom-agent/contracts/types"

export type ViolationType =
  | "transfer_words_reply_action"
  | "faq_turn_handoff"
  | "document_flow_on_shipping"
  | "service_sales_pivot_missing"

export type ScannedMessage = {
  id: string
  conversation_id: string
  role: string
  content: string
  action: string | null
  created_at: string
}

export type ViolationFinding = {
  type: ViolationType
  conversationId: string
  messageId: string
  createdAt: string
  userText: string
  botReply: string
  action: string | null
  detail: string
}

export type ViolationScanResult = {
  scanned: number
  violations: ViolationFinding[]
  draftContracts: ConversationContract[]
}

function asHistory(rows: ScannedMessage[]): HistoryMessage[] {
  return rows
    .filter((row) => row.role === "user" || row.role === "assistant")
    .map((row) => ({
      role: row.role as "user" | "assistant",
      content: row.content,
    }))
}

function detectViolation(
  prior: ScannedMessage[],
  userRow: ScannedMessage,
  assistantRow: ScannedMessage
): ViolationFinding | null {
  const history = asHistory(prior)
  const userText = userRow.content
  const botReply = assistantRow.content
  const action = assistantRow.action

  if (
    action === "reply" &&
    /(?:מעביר|העברתי|מעבירה)/i.test(botReply)
  ) {
    return {
      type: "transfer_words_reply_action",
      conversationId: userRow.conversation_id,
      messageId: assistantRow.id,
      createdAt: assistantRow.created_at,
      userText,
      botReply,
      action,
      detail: "Reply contains transfer wording but action is reply",
    }
  }

  if (
    (action === "human_service" || action === "human_sales") &&
    isKbSelfServiceFaqThisTurn(userText, history)
  ) {
    return {
      type: "faq_turn_handoff",
      conversationId: userRow.conversation_id,
      messageId: assistantRow.id,
      createdAt: assistantRow.created_at,
      userText,
      botReply,
      action,
      detail: "KB self-service FAQ turn routed to human handoff",
    }
  }

  const shippingThread = history.some(
    (message) =>
      message.role === "assistant" &&
      /משלוח|הועמס לשליח|סטטוס/i.test(message.content)
  )
  if (
    shippingThread &&
    isDigitalDocumentRequest(userText) &&
    isActiveDigitalDocumentFlow(history, userText)
  ) {
    return {
      type: "document_flow_on_shipping",
      conversationId: userRow.conversation_id,
      messageId: assistantRow.id,
      createdAt: assistantRow.created_at,
      userText,
      botReply,
      action,
      detail: "Document structured flow active on shipping thread",
    }
  }

  if (
    shippingThread &&
    /(?:תמונה|שטיח|לולאות|לסלון)/i.test(userText) &&
    classifyPostPurchaseCase(userText) !== "defect" &&
    !isShippingStatusQuestion(userText) &&
    action === "human_service"
  ) {
    return {
      type: "service_sales_pivot_missing",
      conversationId: userRow.conversation_id,
      messageId: assistantRow.id,
      createdAt: assistantRow.created_at,
      userText,
      botReply,
      action,
      detail: "Product pivot after shipping may have been misrouted to service handoff",
    }
  }

  return null
}

function violationToDraftContract(finding: ViolationFinding): ConversationContract {
  return {
    id: `draft-${finding.type}-${finding.conversationId}-${finding.messageId.slice(0, 8)}`,
    description: `Auto-draft from sentinel: ${finding.detail}`,
    source: { session: finding.conversationId },
    history: [],
    turn: { text: finding.userText },
    assertions: [
      {
        type: "coerce",
        inputAction: "human_service",
        expectAction: "reply",
      },
    ],
  }
}

export async function loadRecentAssistantTurns(input?: {
  limit?: number
  hours?: number
  conversationIds?: string[]
}) {
  const supabase = getAgentSupabase()
  const limit = input?.limit ?? 200
  const hours = input?.hours ?? 24
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

  let query = supabase
    .from("hom_agent_messages")
    .select("id, conversation_id, role, content, action, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(limit * 4)

  if (input?.conversationIds?.length) {
    query = query.in("conversation_id", input.conversationIds)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as ScannedMessage[]
}

export async function loadGokuLowGradeConversationIds(limit = 50) {
  const supabase = getAgentSupabase()
  const { data, error } = await supabase
    .from("hom_agent_goku_reports")
    .select("conversation_id, grade")
    .lte("grade", 6)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) throw error
  const ids = new Set<string>()
  for (const row of data ?? []) {
    if (row.conversation_id) ids.add(row.conversation_id)
  }
  return [...ids]
}

export async function scanMessagesForViolations(
  rows: ScannedMessage[]
): Promise<ViolationScanResult> {
  const byConversation = new Map<string, ScannedMessage[]>()
  for (const row of rows) {
    const list = byConversation.get(row.conversation_id) ?? []
    list.push(row)
    byConversation.set(row.conversation_id, list)
  }

  const violations: ViolationFinding[] = []

  for (const messages of byConversation.values()) {
    messages.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    for (let index = 0; index < messages.length - 1; index += 1) {
      const userRow = messages[index]
      const assistantRow = messages[index + 1]
      if (userRow.role !== "user" || assistantRow.role !== "assistant") continue

      const prior = messages.slice(0, index)
      const finding = detectViolation(prior, userRow, assistantRow)
      if (finding) violations.push(finding)
    }
  }

  const draftContracts = violations.map(violationToDraftContract)

  return {
    scanned: rows.length,
    violations,
    draftContracts,
  }
}

export async function runViolationScanner(input?: {
  limit?: number
  hours?: number
  includeGoku?: boolean
  writeDrafts?: boolean
}) {
  const conversationIds = input?.includeGoku !== false
    ? await loadGokuLowGradeConversationIds()
    : []

  const rows = await loadRecentAssistantTurns({
    limit: input?.limit,
    hours: input?.hours,
    conversationIds: conversationIds.length ? conversationIds : undefined,
  })

  const result = await scanMessagesForViolations(rows)

  if (input?.writeDrafts && result.draftContracts.length > 0) {
    const draftsDir = join(process.cwd(), "lib/hom-agent/contracts/drafts")
    await mkdir(draftsDir, { recursive: true })
    for (const draft of result.draftContracts) {
      const path = join(draftsDir, `${draft.id}.json`)
      await writeFile(path, `${JSON.stringify(draft, null, 2)}\n`, "utf8")
    }
  }

  return result
}
