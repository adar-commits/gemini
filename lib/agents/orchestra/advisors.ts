import { generateText, jsonSchema, Output } from "ai"
import type {
  AdvisorIntentResult,
  AdvisorPhaseResult,
  AdvisorRiskResult,
  AdvisorStrategyResult,
  OrchestraContext,
} from "@/lib/agents/orchestra/types"
import { CONVERSATION_PHASES } from "@/lib/agents/orchestra/types"

function advisorModel() {
  return (
    process.env.ORCHESTRA_MODEL?.trim() ||
    process.env.AGENT_ROUTER_MODEL?.trim() ||
    "google/gemini-2.5-flash-lite"
  )
}

function historySnippet(ctx: OrchestraContext, maxMessages = 8) {
  return ctx.history
    .slice(-maxMessages)
    .map((m) => `${m.role}: ${m.content.slice(0, 280)}`)
    .join("\n")
}

const SHARED_RULES = `
HoM GROUP WhatsApp bot advisors. Output compact JSON only.
Never invent prices, stock, order status, or policies.
Dissatisfaction without defect → FAQ/exchange info, not service handoff first turn.
Defect/wrong/missing item → service intake before human.
human_sales/human_service only if customer asks for representative or confirms handoff offer.
Living room intake: ask SPACE first — never "למי הסלון משמש".
Shipping policy (times/cost) → FAQ. Order tracking → shipping status.
`.trim()

export async function advisePhase(ctx: OrchestraContext, deterministicPhase: string) {
  const result = await generateText({
    model: advisorModel(),
    system: `${SHARED_RULES}\nYou are the Phase Scout — identify the conversation phase deep in the thread.`,
    messages: [
      {
        role: "user",
        content: [
          `Deterministic phase hint: ${deterministicPhase}`,
          `Turn #${ctx.userTurnCount}`,
          `Last agent: ${ctx.lastAgent ?? "none"}`,
          `Last action: ${ctx.lastAction ?? "none"}`,
          `History:\n${historySnippet(ctx)}`,
          `Latest message:\n${ctx.body}`,
        ].join("\n\n"),
      },
    ],
    maxOutputTokens: 180,
    output: Output.object({
      name: "phase_advisor",
      schema: jsonSchema<AdvisorPhaseResult>({
        type: "object",
        additionalProperties: false,
        required: ["phase", "phase_confidence", "phase_notes"],
        properties: {
          phase: { type: "string", enum: [...CONVERSATION_PHASES] },
          phase_confidence: { type: "number" },
          phase_notes: { type: "string" },
        },
      }),
    }),
  })
  return result.output as AdvisorPhaseResult
}

export async function adviseIntent(ctx: OrchestraContext, deterministicRoute: string | null) {
  const result = await generateText({
    model: advisorModel(),
    system: `${SHARED_RULES}\nYou are the Intent Router — pick the best department for THIS message only.`,
    messages: [
      {
        role: "user",
        content: [
          `Deterministic route hint: ${deterministicRoute ?? "none"}`,
          `Last agent: ${ctx.lastAgent ?? "none"}`,
          `History:\n${historySnippet(ctx, 6)}`,
          `Latest:\n${ctx.body}`,
        ].join("\n\n"),
      },
    ],
    maxOutputTokens: 200,
    output: Output.object({
      name: "intent_advisor",
      schema: jsonSchema<AdvisorIntentResult>({
        type: "object",
        additionalProperties: false,
        required: [
          "recommended_route",
          "route_confidence",
          "intent_summary",
          "stay_on_current",
        ],
        properties: {
          recommended_route: {
            type: "string",
            enum: [
              "ROUTE_TO_INFO_AGENT",
              "ROUTE_TO_SALES_AGENT",
              "ROUTE_TO_SERVICE_AGENT",
              "ROUTE_TO_SHIPPING_STATUS",
              "faq",
              "sales",
              "service",
              "shipping",
              "NONE",
            ],
          },
          route_confidence: { type: "number" },
          intent_summary: { type: "string" },
          stay_on_current: { type: "boolean" },
        },
      }),
    }),
  })
  const raw = result.output as {
    recommended_route: string
    route_confidence: number
    intent_summary: string
    stay_on_current: boolean
  }
  const route = String(raw.recommended_route ?? "")
  return {
    ...raw,
    recommended_route:
      !route || route === "NONE" ? null : (route as AdvisorIntentResult["recommended_route"]),
  } as AdvisorIntentResult
}

export async function adviseRisk(ctx: OrchestraContext, kbExcerpt: string) {
  const result = await generateText({
    model: advisorModel(),
    system: `${SHARED_RULES}\nYou are the Risk Guard — flag policy/stock/hallucination/handoff risks.`,
    messages: [
      {
        role: "user",
        content: [
          `Latest:\n${ctx.body}`,
          `Draft context — last agent ${ctx.lastAgent ?? "none"}`,
          `KB excerpt:\n${kbExcerpt.slice(0, 2500)}`,
        ].join("\n\n"),
      },
    ],
    maxOutputTokens: 220,
    output: Output.object({
      name: "risk_advisor",
      schema: jsonSchema<AdvisorRiskResult>({
        type: "object",
        additionalProperties: false,
        required: ["risks", "must_not_say", "kb_only_facts"],
        properties: {
          risks: { type: "array", items: { type: "string" }, maxItems: 4 },
          must_not_say: { type: "array", items: { type: "string" }, maxItems: 4 },
          kb_only_facts: { type: "boolean" },
        },
      }),
    }),
  })
  return result.output as AdvisorRiskResult
}

export async function adviseStrategy(ctx: OrchestraContext, phase: string) {
  const result = await generateText({
    model: advisorModel(),
    system: `${SHARED_RULES}\nYou are the Strategy Coach — one concrete next step for the replying agent.`,
    messages: [
      {
        role: "user",
        content: [
          `Phase: ${phase}`,
          `Turn #${ctx.userTurnCount}`,
          `History:\n${historySnippet(ctx, 6)}`,
          `Latest:\n${ctx.body}`,
        ].join("\n\n"),
      },
    ],
    maxOutputTokens: 200,
    output: Output.object({
      name: "strategy_advisor",
      schema: jsonSchema<AdvisorStrategyResult>({
        type: "object",
        additionalProperties: false,
        required: ["next_step", "escalate_human"],
        properties: {
          next_step: { type: "string" },
          ask_one_question: { type: "string" },
          escalate_human: { type: "boolean" },
        },
      }),
    }),
  })
  const raw = result.output as AdvisorStrategyResult & { ask_one_question: string }
  return {
    ...raw,
    ask_one_question: raw.ask_one_question?.trim() || null,
  }
}
