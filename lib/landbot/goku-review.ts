import { generateText, jsonSchema, Output } from "ai"
import { getAgentSupabase } from "@/lib/agents/supabase"
import { insertLearnedRule } from "@/lib/agents/learned-rules"
import { recordTokenUsage } from "@/lib/agent-core/token-usage"

/**
 * GOKU trainer — Fable-powered receptionist coach.
 * Reviews every conversation after it ends (inactivity close, handoff, or end),
 * grades the bot's performance, and feeds generalizable corrections into the
 * learned-rules pipeline (capped + deduped downstream).
 */

const END_BUFFER_MS = 5 * 60_000
const SCAN_WINDOW_MS = 48 * 60 * 60 * 1000
const TRANSCRIPT_LIMIT = 40
const MAX_RULES_PER_REVIEW = 2

export function gokuModel() {
  return process.env.GOKU_REVIEW_MODEL?.trim() || "anthropic/claude-fable-5.1"
}

function gokuEnabled() {
  const raw = process.env.GOKU_REVIEW_ENABLED?.trim().toLowerCase()
  return raw !== "0" && raw !== "false" && raw !== "off"
}

function batchSize() {
  const raw = Number(process.env.GOKU_REVIEW_BATCH_SIZE ?? "6")
  return Number.isFinite(raw) && raw > 0 ? Math.min(raw, 15) : 6
}

type GokuIssue = { type: string; detail: string }

type GokuVerdict = {
  verdict: "ok" | "issue"
  grade: number
  summary: string
  issues: GokuIssue[]
  proposed_rules: string[]
  kb_gaps: string[]
}

const GOKU_SYSTEM = `
You are GOKU — the ultimate receptionist trainer for the HoM GROUP (carpetshop.co.il / השטיח האדום) WhatsApp bot.
You review a FINISHED conversation transcript and coach the bot like a world-class hospitality manager.

Grade 1-10 as a receptionist: context awareness, warmth in Hebrew, correct routing (FAQ vs sales vs service vs human),
never repeating itself, never losing the thread, and knowing when to hand off to a human gracefully.

Current locked policies (do NOT propose rules that duplicate or contradict these):
- Dissatisfaction without defect → FAQ return/exchange options first, sales-consult offer embedded.
- Price match / missing credit → FAQ policy first; Service only if the customer insists.
- Returns/cancellations → portal https://returns.carpetshop.co.il/; exchanges → branch or paid courier, never the portal.
- Never invent stock, prices, order status, or policy. Product-type browsing (צמר, מידות) = KB + sales intake, not inventory tool.
- Gender-neutral customer address; concise warm Hebrew; header *הום בוט :)*.
- Thanks/farewell → warm reply, stay open (inactivity watcher closes later).

Output rules:
- verdict "issue" only for material problems a customer would feel. Otherwise "ok".
- summary: 2-4 sentences in Hebrew for the owner — what went well, what failed, what the customer actually wanted.
- issues: short typed list (routing, context_loss, repetition, tone, missed_handoff, wrong_info, kb_missing, other).
- proposed_rules: 0-${MAX_RULES_PER_REVIEW} GENERALIZABLE prompt rules (Hebrew or English, imperative, ≤200 chars each),
  in the style: "If the customer X, do Y". Never include names, phones, order numbers, or one-off specifics.
  Propose a rule ONLY when the same failure would repeat for other customers. Duplicating existing policies is forbidden.
- kb_gaps: knowledge the bot lacked (e.g. "אין מידע על טרייד אין") — facts the owner should add, not behavior rules.
`.trim()

type SessionRow = {
  conversation_id: string
  customer_phone: string | null
  inactivity_closed_at: string | null
  updated_at: string | null
}

type MessageRow = {
  role: string
  content: string
  action: string | null
  created_at: string
}

async function lastMessages(conversationId: string): Promise<MessageRow[]> {
  const supabase = getAgentSupabase()
  const { data, error } = await supabase
    .from("hom_agent_messages")
    .select("role, content, action, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(TRANSCRIPT_LIMIT)

  if (error) throw error
  return ((data ?? []) as MessageRow[]).reverse()
}

function endTrigger(messages: MessageRow[], session: SessionRow): string | null {
  if (session.inactivity_closed_at) return "inactivity_close"
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.role !== "assistant") continue
    if (message.action === "human_sales" || message.action === "human_service") {
      return "handoff"
    }
    if (message.action === "end") return "end"
    return null
  }
  return null
}

async function alreadyReviewed(conversationId: string, reviewedUpTo: string) {
  const supabase = getAgentSupabase()
  const { data, error } = await supabase
    .from("hom_agent_goku_reviews")
    .select("id")
    .eq("conversation_id", conversationId)
    .gte("reviewed_up_to", reviewedUpTo)
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return Boolean(data)
}

export async function findEndedConversations(limit = batchSize()) {
  const supabase = getAgentSupabase()
  const windowStart = new Date(Date.now() - SCAN_WINDOW_MS).toISOString()
  const { data, error } = await supabase
    .from("hom_agent_sessions")
    .select("conversation_id, customer_phone, inactivity_closed_at, updated_at")
    .gte("updated_at", windowStart)
    .order("updated_at", { ascending: false })
    .limit(60)

  if (error) throw error

  const candidates: Array<{
    session: SessionRow
    messages: MessageRow[]
    trigger: string
    reviewedUpTo: string
  }> = []

  for (const session of (data ?? []) as SessionRow[]) {
    if (candidates.length >= limit) break
    const messages = await lastMessages(session.conversation_id)
    if (messages.length < 2) continue

    const lastAt = messages[messages.length - 1]!.created_at
    if (Date.now() - Date.parse(lastAt) < END_BUFFER_MS) continue

    const trigger = endTrigger(messages, session)
    if (!trigger) continue
    if (await alreadyReviewed(session.conversation_id, lastAt)) continue

    candidates.push({ session, messages, trigger, reviewedUpTo: lastAt })
  }

  return candidates
}

function formatTranscript(messages: MessageRow[]) {
  return messages
    .map((message) => {
      const speaker = message.role === "user" ? "לקוח" : "בוט"
      const action = message.action ? ` [action: ${message.action}]` : ""
      return `${speaker}${action}: ${message.content}`
    })
    .join("\n")
}

/** Rules containing customer-specific identifiers must never enter the prompt. */
function isSafeGokuRule(rule: string) {
  const text = rule.trim()
  if (text.length < 20 || text.length > 240) return false
  if (/\d{5,}/.test(text)) return false
  if (/05\d[- ]?\d{3}/.test(text)) return false
  return true
}

export async function reviewConversationWithGoku(input: {
  conversationId: string
  messages: MessageRow[]
  trigger: string
  reviewedUpTo: string
}) {
  const model = gokuModel()
  const transcript = formatTranscript(input.messages)

  const result = await generateText({
    model,
    system: GOKU_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Conversation ${input.conversationId} ended via: ${input.trigger}\n\nTranscript:\n${transcript}`,
      },
    ],
    maxOutputTokens: 900,
    output: Output.object({
      name: "goku_review",
      schema: jsonSchema<GokuVerdict>({
        type: "object",
        additionalProperties: false,
        required: ["verdict", "grade", "summary", "issues", "proposed_rules", "kb_gaps"],
        properties: {
          verdict: { type: "string", enum: ["ok", "issue"] },
          grade: { type: "integer", minimum: 1, maximum: 10 },
          summary: { type: "string" },
          issues: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["type", "detail"],
              properties: {
                type: { type: "string" },
                detail: { type: "string" },
              },
            },
          },
          proposed_rules: { type: "array", items: { type: "string" } },
          kb_gaps: { type: "array", items: { type: "string" } },
        },
      }),
    }),
  })

  recordTokenUsage({
    conversationId: input.conversationId,
    purpose: "goku",
    agent: "master",
    model,
    usage: result.usage,
  })

  let verdict: GokuVerdict
  try {
    verdict = result.output as GokuVerdict
  } catch {
    throw new Error("GOKU review output could not be parsed")
  }

  return { verdict, model }
}

export async function runGokuReviewBatch() {
  if (!gokuEnabled()) {
    return { ok: true, skipped: "disabled", reviewed: 0 }
  }

  const candidates = await findEndedConversations()
  if (!candidates.length) {
    return { ok: true, reviewed: 0, rules_inserted: 0 }
  }

  const supabase = getAgentSupabase()
  let reviewed = 0
  let rulesInserted = 0
  let issues = 0
  const errors: string[] = []

  for (const candidate of candidates) {
    try {
      const { verdict, model } = await reviewConversationWithGoku({
        conversationId: candidate.session.conversation_id,
        messages: candidate.messages,
        trigger: candidate.trigger,
        reviewedUpTo: candidate.reviewedUpTo,
      })

      let inserted = 0
      if (verdict.verdict === "issue") {
        for (const rule of verdict.proposed_rules.slice(0, MAX_RULES_PER_REVIEW)) {
          if (!isSafeGokuRule(rule)) continue
          try {
            const id = await insertLearnedRule({
              ruleKind: "prompt_rule",
              agent: "all",
              ruleText: rule.trim(),
              sourceUserText: `goku:${candidate.session.conversation_id}`,
            })
            if (id) inserted += 1
          } catch {
            // unsafe/duplicate rule — feedback stays in the review row
          }
        }
      }

      const { error } = await supabase.from("hom_agent_goku_reviews").insert({
        conversation_id: candidate.session.conversation_id,
        reviewed_up_to: candidate.reviewedUpTo,
        trigger: candidate.trigger,
        verdict: verdict.verdict,
        grade: verdict.grade,
        summary: verdict.summary.slice(0, 1000),
        issues: verdict.issues,
        proposed_rules: verdict.proposed_rules,
        kb_gaps: verdict.kb_gaps,
        rules_inserted: inserted,
        model,
      })

      if (error && error.code !== "23505") throw error

      reviewed += 1
      rulesInserted += inserted
      if (verdict.verdict === "issue") issues += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : "GOKU review failed"
      errors.push(`${candidate.session.conversation_id}: ${message}`)
      console.error("[goku] review failed", candidate.session.conversation_id, message)
    }
  }

  return { ok: true, reviewed, issues, rules_inserted: rulesInserted, errors }
}

export async function gokuStats() {
  const supabase = getAgentSupabase()
  const [{ count: total }, { count: flagged }, { data: recent }] = await Promise.all([
    supabase.from("hom_agent_goku_reviews").select("id", { count: "exact", head: true }),
    supabase
      .from("hom_agent_goku_reviews")
      .select("id", { count: "exact", head: true })
      .eq("verdict", "issue"),
    supabase
      .from("hom_agent_goku_reviews")
      .select("conversation_id, trigger, verdict, grade, summary, kb_gaps, rules_inserted, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
  ])

  return {
    total_reviews: total ?? 0,
    flagged_issues: flagged ?? 0,
    model: gokuModel(),
    recent: recent ?? [],
  }
}
