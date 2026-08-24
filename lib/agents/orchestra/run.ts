import { selectFaqKb } from "@/lib/agents/kb"
import { guessLearnedFastReply } from "@/lib/agents/learned-rules"
import { isOffTopicQuestion } from "@/lib/agents/off-topic"
import { shouldUseSalesIntakeFastPath } from "@/lib/agents/sales-intake"
import { guessMasterRoute } from "@/lib/agents/route-intent"
import {
  detectDeterministicPhase,
  detectDeterministicRoute,
  extractEntities,
} from "@/lib/agents/orchestra/deterministic"
import {
  adviseIntent,
  advisePhase,
  adviseRisk,
  adviseStrategy,
} from "@/lib/agents/orchestra/advisors"
import type { OrchestraContext, OrchestraResult } from "@/lib/agents/orchestra/types"
import type { MasterAction } from "@/lib/agents/types"

function orchestraEnabled() {
  const raw = process.env.ORCHESTRA_ENABLED?.trim().toLowerCase()
  return raw !== "0" && raw !== "false" && raw !== "off"
}

function orchestraBudgetMs() {
  const raw = Number(process.env.ORCHESTRA_BUDGET_MS ?? "4000")
  return Number.isFinite(raw) && raw > 500 ? Math.min(raw, 4500) : 4000
}

function shouldSkipOrchestra(ctx: OrchestraContext) {
  const body = ctx.body.trim()
  if (!body) return "empty_message"
  if (shouldUseSalesIntakeFastPath(body, ctx.history, ctx.lastAgent)) {
    return "sales_intake_fast_path"
  }
  if (guessMasterRoute(body)) return "deterministic_route"
  if (body.length <= 12 && /^(שלום|היי|הי|אהלן|תודה|כן|לא|אוקיי)/iu.test(body)) {
    return "short_deterministic"
  }
  return null
}

async function withBudget<T>(
  promise: Promise<T>,
  fallback: T,
  budgetMs: number
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), budgetMs)),
  ])
}

const EMPTY_PHASE = {
  phase: "ambiguous" as const,
  phase_confidence: 0,
  phase_notes: "",
}
const EMPTY_INTENT = {
  recommended_route: null,
  route_confidence: 0,
  intent_summary: "",
  stay_on_current: false,
}
const EMPTY_RISK = { risks: [] as string[], must_not_say: [] as string[], kb_only_facts: true }
const EMPTY_STRATEGY = {
  next_step: "",
  ask_one_question: null as string | null,
  escalate_human: false,
}

export async function runConversationOrchestra(
  ctx: OrchestraContext
): Promise<OrchestraResult> {
  const started = Date.now()
  if (!orchestraEnabled()) {
    return {
      enabled: false,
      skipped: true,
      skip_reason: "disabled",
      elapsed_ms: 0,
      deterministic: {
        phase: "ambiguous",
        entities: extractEntities(ctx.body, ""),
        route_hint: null,
      },
      phase: EMPTY_PHASE,
      intent: EMPTY_INTENT,
      risk: EMPTY_RISK,
      strategy: EMPTY_STRATEGY,
    }
  }

  const skip = shouldSkipOrchestra(ctx)
  const historyText = ctx.history.map((m) => m.content).join("\n")
  const detPhase = detectDeterministicPhase(ctx)
  const detRoute = detectDeterministicRoute(ctx)
  const detEntities = extractEntities(ctx.body, historyText)

  if (skip) {
    return {
      enabled: true,
      skipped: true,
      skip_reason: skip,
      elapsed_ms: Date.now() - started,
      deterministic: { phase: detPhase, entities: detEntities, route_hint: detRoute },
      phase: { phase: detPhase, phase_confidence: 0.85, phase_notes: skip },
      intent: {
        recommended_route: detRoute,
        route_confidence: detRoute ? 0.85 : 0,
        intent_summary: "",
        stay_on_current: Boolean(ctx.lastAgent),
      },
      risk: EMPTY_RISK,
      strategy: EMPTY_STRATEGY,
    }
  }

  const kbExcerpt = selectFaqKb(ctx.body)
  const budget = orchestraBudgetMs()
  const remaining = () => Math.max(budget - (Date.now() - started), 800)

  const [phase, intent, risk, strategy] = await Promise.all([
    withBudget(
      advisePhase(ctx, detPhase).catch(() => ({
        phase: detPhase,
        phase_confidence: 0.6,
        phase_notes: "phase advisor fallback",
      })),
      { phase: detPhase, phase_confidence: 0.5, phase_notes: "phase timeout" },
      remaining()
    ),
    withBudget(
      adviseIntent(ctx, detRoute).catch(() => ({
        ...EMPTY_INTENT,
        recommended_route: detRoute,
        route_confidence: detRoute ? 0.6 : 0,
      })),
      { ...EMPTY_INTENT, recommended_route: detRoute },
      remaining()
    ),
    withBudget(adviseRisk(ctx, kbExcerpt).catch(() => EMPTY_RISK), EMPTY_RISK, remaining()),
    withBudget(
      adviseStrategy(ctx, detPhase).catch(() => EMPTY_STRATEGY),
      EMPTY_STRATEGY,
      remaining()
    ),
  ])

  return {
    enabled: true,
    skipped: false,
    elapsed_ms: Date.now() - started,
    deterministic: { phase: detPhase, entities: detEntities, route_hint: detRoute },
    phase,
    intent,
    risk,
    strategy,
  }
}

export function orchestraMasterRoute(
  orchestra: OrchestraResult
): MasterAction | null {
  const route = orchestra.intent.recommended_route
  if (!route || orchestra.intent.route_confidence < 0.72) return null
  if (
    route === "ROUTE_TO_INFO_AGENT" ||
    route === "ROUTE_TO_SALES_AGENT" ||
    route === "ROUTE_TO_SERVICE_AGENT" ||
    route === "ROUTE_TO_SHIPPING_STATUS"
  ) {
    return route
  }
  return null
}

export function formatOrchestraBrief(orchestra: OrchestraResult) {
  if (!orchestra.enabled || orchestra.skipped) return ""

  const lines = [
    "### ORCHESTRA BRIEF (internal — follow strictly)",
    `Phase: ${orchestra.phase.phase} (${Math.round(orchestra.phase.phase_confidence * 100)}%) — ${orchestra.phase.phase_notes}`,
    `Intent: ${orchestra.intent.intent_summary || "—"}`,
    `Route hint: ${orchestra.intent.recommended_route ?? orchestra.deterministic.route_hint ?? "none"} (${Math.round(orchestra.intent.route_confidence * 100)}%)`,
    `Stay on current agent: ${orchestra.intent.stay_on_current ? "yes" : "no"}`,
  ]

  const ent = orchestra.deterministic.entities
  if (ent.products.length) lines.push(`Products mentioned: ${ent.products.join("; ")}`)
  if (ent.spaces.length) lines.push(`Spaces: ${ent.spaces.join(", ")}`)
  if (ent.budget_hint) lines.push(`Budget hint: ${ent.budget_hint}`)
  if (ent.order_hints.length) lines.push(`Order/shipping signals: ${ent.order_hints.join(", ")}`)

  if (orchestra.risk.risks.length) {
    lines.push(`Risks: ${orchestra.risk.risks.join(" | ")}`)
  }
  if (orchestra.risk.must_not_say.length) {
    lines.push(`MUST NOT say/do: ${orchestra.risk.must_not_say.join(" | ")}`)
  }
  if (orchestra.risk.kb_only_facts) {
    lines.push("Use KB facts only — do not invent policy, stock, or prices.")
  }
  if (orchestra.strategy.next_step) {
    lines.push(`Next step: ${orchestra.strategy.next_step}`)
  }
  if (orchestra.strategy.ask_one_question) {
    lines.push(`Ask ONE question if needed: ${orchestra.strategy.ask_one_question}`)
  }
  if (orchestra.strategy.escalate_human) {
    lines.push("Offer human handoff only if appropriate — never skip intake when required.")
  }

  lines.push(`(Orchestra latency: ${orchestra.elapsed_ms}ms)`)
  return `\n${lines.join("\n")}\n`
}

export async function shouldRunOrchestra(ctx: OrchestraContext) {
  if (!orchestraEnabled()) return false
  if (shouldSkipOrchestra(ctx)) return false
  if (isOffTopicQuestion(ctx.body)) return false
  const fast = await guessLearnedFastReply(ctx.body)
  return !fast
}
