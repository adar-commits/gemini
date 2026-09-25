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
import { executeCursorAutomationQa } from "@/lib/landbot/cursor-automation-qa"

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

  const alreadyHandedOff = prior.some(
    (row) =>
      row.role === "assistant" &&
      (row.action === "human_service" || row.action === "human_sales")
  )

  if (
    action === "reply" &&
    !alreadyHandedOff &&
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

/** Max QA automation events one scan may start — keeps the operator dashboard readable. */
export const VIOLATION_QA_MAX_PER_SCAN = 5

function violationOperatorNote(finding: ViolationFinding) {
  const prefix = "זיהוי אוטומטי מהסורק היומי (לא נכתב על ידי נציג):"
  switch (finding.type) {
    case "transfer_words_reply_action":
      return `${prefix} הבוט כתב ללקוח שהוא מעביר לנציג, אבל לא הייתה העברה בפועל (action=reply) — הלקוח מחכה לנציג שלא יגיע.`
    case "document_flow_on_shipping":
      return `${prefix} באמצע שיחת משלוח הבוט נכנס לתהליך מסמכים (קבלה/חשבונית) במקום להמשיך בבירור ההזמנה.`
    case "faq_turn_handoff":
      return `${prefix} שאלת מדיניות שהבוט אמור לענות עליה בעצמו הועברה לנציג.`
    case "service_sales_pivot_missing":
      return `${prefix} אחרי שיחת משלוח הלקוח עבר לשאלה על מוצר, והבוט העביר לשירות במקום למכירות.`
    default: {
      const unhandled: never = finding.type
      return `${prefix} ${unhandled}`
    }
  }
}

/**
 * Findings worth a QA run: handoff turns already start a human_assign event, so only
 * silent failures (no handoff happened) are sent. One per conversation, newest first.
 */
export function selectViolationsForQa(
  violations: ViolationFinding[],
  max = VIOLATION_QA_MAX_PER_SCAN
) {
  const picked: ViolationFinding[] = []
  const seen = new Set<string>()
  const newestFirst = [...violations].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
  for (const finding of newestFirst) {
    if (finding.action === "human_service" || finding.action === "human_sales") continue
    if (seen.has(finding.conversationId)) continue
    seen.add(finding.conversationId)
    picked.push(finding)
    if (picked.length >= max) break
  }
  return picked
}

export function violationQaEnabled() {
  const raw = process.env.VIOLATION_SCANNER_QA?.trim().toLowerCase()
  return !(raw === "0" || raw === "false" || raw === "off" || raw === "no")
}

/** Sends silent failures to the Cursor QA automation (Cursor tokens — no AI Gateway call). */
export async function notifyViolationsToQa(violations: ViolationFinding[]) {
  if (!violationQaEnabled()) return { sent: 0, skipped: 0, failed: 0 }
  let sent = 0
  let skipped = 0
  let failed = 0
  for (const finding of selectViolationsForQa(violations)) {
    try {
      const result = await executeCursorAutomationQa({
        conversationId: finding.conversationId,
        trigger: "violation",
        lastUserMessage: finding.userText,
        lastBotReply: finding.botReply,
        idempotencyKey: `violation:${finding.conversationId}:${finding.messageId}`,
        operatorNotes: violationOperatorNote(finding),
        skipTriggerCheck: true,
      })
      if ("skipped" in result) skipped += 1
      else if (result.webhook.ok) sent += 1
      else failed += 1
    } catch (error) {
      failed += 1
      console.warn("[violation-scanner] QA notify failed", {
        conversationId: finding.conversationId,
        type: finding.type,
        error: error instanceof Error ? error.message : error,
      })
    }
  }
  return { sent, skipped, failed }
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
