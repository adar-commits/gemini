import { getAgentSupabase } from "@/lib/agents/supabase"
import { isCustomerServiceOpener } from "@/lib/agents/customer-service-opener"
import type { MasterAction } from "@/lib/agents/types"
import type { AgentId } from "@/lib/agents/types"

export type LearnedRuleKind =
  | "route_regex"
  | "greeting_pattern"
  | "prompt_rule"
  | "off_topic_exception"
  | "fast_reply"
  | "reply_guard"

export type LearnedRuleRow = {
  id: string
  rule_kind: LearnedRuleKind
  agent: string | null
  pattern: string | null
  route_action: string | null
  rule_text: string
  source_user_text: string | null
  status: string
}

const CACHE_MS = 60_000
let cachedAt = 0
let cachedRules: LearnedRuleRow[] = []

function autofixEnabled() {
  const raw = process.env.SHADOW_AUTOFIX_ENABLED?.trim().toLowerCase()
  return raw !== "0" && raw !== "false" && raw !== "off"
}

export function learnedRulesEnabled() {
  return autofixEnabled() || cachedRules.length > 0
}

export async function loadLearnedRules(force = false) {
  if (!force && cachedRules.length && Date.now() - cachedAt < CACHE_MS) {
    return cachedRules
  }

  const supabase = getAgentSupabase()
  const { data, error } = await supabase
    .from("hom_agent_learned_rules")
    .select("id, rule_kind, agent, pattern, route_action, rule_text, source_user_text, status")
    .eq("status", "active")
    .order("created_at", { ascending: true })

  if (error) throw error
  cachedRules = (data ?? []) as LearnedRuleRow[]
  cachedAt = Date.now()
  return cachedRules
}

export function invalidateLearnedRulesCache() {
  cachedAt = 0
  cachedRules = []
}

export async function guessLearnedFastReply(body: string): Promise<string | null> {
  const rules = await loadLearnedRules()
  const text = body.trim()
  if (!text) return null

  for (const rule of rules) {
    if (rule.rule_kind !== "fast_reply" || !rule.pattern) continue
    try {
      if (new RegExp(rule.pattern, "iu").test(text)) {
        return rule.rule_text.trim()
      }
    } catch {
      continue
    }
  }
  return null
}

export async function matchesLearnedReplyGuard(agent: AgentId, reply: string) {
  const rules = await loadLearnedRules()
  const text = reply.trim()
  if (!text) return false

  for (const rule of rules) {
    if (rule.rule_kind !== "reply_guard" || !rule.pattern) continue
    const target = rule.agent?.trim() || "all"
    if (target !== "all" && target !== agent) continue
    try {
      if (new RegExp(rule.pattern, "iu").test(text)) return true
    } catch {
      continue
    }
  }
  return false
}

export async function guessLearnedRoute(body: string): Promise<MasterAction | null> {
  const text = body.trim()
  if (!text) return null
  if (isCustomerServiceOpener(text)) return null

  const rules = await loadLearnedRules()

  for (const rule of rules) {
    if (rule.rule_kind !== "route_regex" || !rule.pattern || !rule.route_action) continue
    try {
      const re = new RegExp(rule.pattern, "iu")
      if (!re.test(text)) continue
      if (
        rule.route_action === "ROUTE_TO_INFO_AGENT" ||
        rule.route_action === "ROUTE_TO_SALES_AGENT" ||
        rule.route_action === "ROUTE_TO_SERVICE_AGENT" ||
        rule.route_action === "ROUTE_TO_SHIPPING_STATUS"
      ) {
        return rule.route_action
      }
    } catch {
      continue
    }
  }
  return null
}

export async function matchesLearnedGreeting(text: string) {
  const rules = await loadLearnedRules()
  const body = text.trim()
  if (!body) return false

  for (const rule of rules) {
    if (rule.rule_kind !== "greeting_pattern" || !rule.pattern) continue
    try {
      if (new RegExp(rule.pattern, "iu").test(body)) return true
    } catch {
      continue
    }
  }
  return false
}

const STALE_LEARNED_RULE_RE =
  /shadow-autofix:\s*no safe rule passed validation|לא הצלחתי להבין את השאלה,\s*נסה שוב/i

function isUsableLearnedPromptRule(rule: LearnedRuleRow) {
  const text = rule.rule_text.trim()
  if (!text || STALE_LEARNED_RULE_RE.test(text)) return false
  return rule.rule_kind === "prompt_rule" || rule.rule_kind === "off_topic_exception"
}

export async function learnedPromptRules(agent: AgentId | "all") {
  const rules = await loadLearnedRules()
  const lines = rules
    .filter(isUsableLearnedPromptRule)
    .filter((rule) => {
      const target = rule.agent?.trim() || "all"
      return target === "all" || target === agent
    })
    .map((rule) => `- ${rule.rule_text.trim()}`)

  if (!lines.length) return ""
  return `\n### LEARNED RULES (auto from shadow review — follow these)\n${lines.join("\n")}\n`
}

export function isSafeLearnedPattern(pattern: string) {
  const trimmed = pattern.trim()
  if (!trimmed || trimmed.length > 160) return false
  if (/^\.\*$|^\.\+$|\(\.\*\)|\(\.\+\)/.test(trimmed)) return false
  try {
    RegExp(trimmed, "iu")
    return true
  } catch {
    return false
  }
}

const VALID_LEARNED_AGENTS = new Set(["all", "master", "sales", "faq", "service"])

function normalizeLearnedRuleAgent(agent?: string | null) {
  const value = agent?.trim().toLowerCase() || "all"
  if (VALID_LEARNED_AGENTS.has(value)) return value
  return "all"
}

export async function insertLearnedRule(input: {
  shadowReviewId?: string | null
  ruleKind: LearnedRuleKind
  agent?: string | null
  pattern?: string | null
  routeAction?: string | null
  ruleText: string
  sourceUserText?: string | null
}) {
  if (input.pattern && !isSafeLearnedPattern(input.pattern)) {
    throw new Error(`Unsafe regex pattern: ${input.pattern}`)
  }

  const supabase = getAgentSupabase()
  const { data, error } = await supabase
    .from("hom_agent_learned_rules")
    .insert({
      shadow_review_id: input.shadowReviewId ?? null,
      rule_kind: input.ruleKind,
      agent: normalizeLearnedRuleAgent(input.agent),
      pattern: input.pattern ?? null,
      route_action: input.routeAction ?? null,
      rule_text: input.ruleText,
      source_user_text: input.sourceUserText ?? null,
      status: "active",
    })
    .select("id")
    .single()

  if (error) {
    if (error.code === "23505") return null
    throw error
  }

  invalidateLearnedRulesCache()
  return data.id as string
}

export async function learnedRuleStats() {
  const supabase = getAgentSupabase()
  const { count, error } = await supabase
    .from("hom_agent_learned_rules")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
  if (error) throw error
  return { active_rules: count ?? 0, autofix_enabled: autofixEnabled() }
}
