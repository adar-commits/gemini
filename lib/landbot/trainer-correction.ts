import { generateText, jsonSchema, Output } from "ai"
import { getConversationContext, getConversationTail } from "@/lib/agents/memory"
import {
  insertLearnedRule,
  isSafeLearnedPattern,
  type LearnedRuleKind,
} from "@/lib/agents/learned-rules"
import { runMasterConversation } from "@/lib/agents/run-agent"
import type { HistoryMessage } from "@/lib/agents/types"
import type { UserTurn } from "@/lib/agents/user-turn"
import {
  shouldSendTrainerFixedPreview,
  stripTrainerCorrectionPrefix,
  TRAINER_CORRECTION_PREFIX,
} from "@/lib/landbot/training-guards"

export const TRAINER_CORRECTION_ACK = "קיבלתי מאמן, מייד אבצע תיקונים..."
export const TRAINER_CORRECTION_DONE = "מצוין אני מתוקן עכשיו"

const CORRECTION_PARSE_RE =
  /במקום\s+(?:לענות(?:\s+לי)?\s+)?([\s\S]+?)\s+הי(?:ית|יה)\s+צריך\s+לענות(?:\s+לי)?\s+([\s\S]+)/i

function correctionModel() {
  return (
    process.env.TRAINER_CORRECTION_MODEL?.trim() ||
    process.env.SHADOW_AUTOFIX_MODEL?.trim() ||
    process.env.AGENT_ROUTER_MODEL?.trim() ||
    "google/gemini-2.5-flash-lite"
  )
}

function findTargetUserQuestion(
  history: HistoryMessage[],
  correctionBody: string
) {
  const correctionNorm = correctionBody.replace(/\s+/g, " ").trim()
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const message = history[i]
    if (message.role !== "user") continue
    const content = message.content.replace(/\s+/g, " ").trim()
    if (content.startsWith(TRAINER_CORRECTION_PREFIX)) continue
    if (content === correctionNorm) continue
    return content
  }
  return null
}

function parseCorrectionRegex(body: string) {
  const match = body.match(CORRECTION_PARSE_RE)
  if (!match) return null
  return {
    wrongReply: match[1]?.trim() ?? "",
    correctReply: match[2]?.trim() ?? "",
  }
}

type ProposedTrainerFix = {
  rule_kind: LearnedRuleKind
  agent?: string
  pattern?: string
  route_action?: string
  rule_text: string
  user_question?: string
}

const TRAINER_FIX_SYSTEM = `
You parse a Hebrew trainer correction for a WhatsApp carpet-store bot.
The trainer writes: "במקום לענות לי X היית צריך לענות לי Y" (X = wrong bot reply, Y = correct reply).

Return at most ONE learned runtime rule plus metadata.
Allowed rule_kind: prompt_rule (preferred), route_regex, greeting_pattern, off_topic_exception.

FORBID inventing store policy. Encode only the behavior gap shown in the example.
Keep rule_text short and actionable for the agent prompt.
`.trim()

async function proposeTrainerFix(input: {
  correctionBody: string
  userQuestion: string | null
  wrongReply: string
  correctReply: string
  history: HistoryMessage[]
}) {
  const result = await generateText({
    model: correctionModel(),
    system: TRAINER_FIX_SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          `correction: ${input.correctionBody}`,
          `user_question: ${input.userQuestion ?? ""}`,
          `wrong_reply: ${input.wrongReply}`,
          `correct_reply: ${input.correctReply}`,
          `recent_history: ${JSON.stringify(input.history.slice(-6))}`,
        ].join("\n"),
      },
    ],
    maxOutputTokens: 400,
    output: Output.object({
      name: "trainer_fix",
      schema: jsonSchema<ProposedTrainerFix>({
        type: "object",
        additionalProperties: false,
        required: ["rule_kind", "rule_text"],
        properties: {
          rule_kind: {
            type: "string",
            enum: [
              "route_regex",
              "greeting_pattern",
              "prompt_rule",
              "off_topic_exception",
            ],
          },
          agent: { type: "string" },
          pattern: { type: "string" },
          route_action: { type: "string" },
          rule_text: { type: "string" },
          user_question: { type: "string" },
        },
      }),
    }),
  })

  try {
    return result.output as ProposedTrainerFix
  } catch {
    return null
  }
}

function outboundReply(result: {
  reply?: string
  action?: string
}) {
  if (result.reply) return result.reply
  if (result.action === "human_service") {
    return "*הום בוט :)*\nהפנייה הועברה לנציג שירות. ניצור קשר בהקדם."
  }
  if (result.action === "human_sales") {
    return "*הום בוט :)*\nהפנייה הועברה ליועץ מכירות. ניצור קשר בהקדם."
  }
  return ""
}

export type TrainerCorrectionResult = {
  ok: boolean
  learnedRuleId?: string | null
  targetUserQuestion?: string | null
  fixedReply?: string
  sendFixed: boolean
  skipReason?: string
}

export async function processTrainerCorrection(input: {
  conversationId: string
  correctionText: string
  customerName?: string
}): Promise<TrainerCorrectionResult> {
  const correctionBody = stripTrainerCorrectionPrefix(input.correctionText)
  const { history } = await getConversationContext(input.conversationId)
  const tail = await getConversationTail(input.conversationId)

  const parsed = parseCorrectionRegex(correctionBody)
  const targetUserQuestion =
    findTargetUserQuestion(history, input.correctionText) ??
    parsed?.wrongReply ??
    null

  const wrongReply = parsed?.wrongReply ?? ""
  const correctReplyHint = parsed?.correctReply ?? ""

  const proposal =
    (await proposeTrainerFix({
      correctionBody,
      userQuestion: targetUserQuestion,
      wrongReply,
      correctReply: correctReplyHint,
      history,
    })) ??
    ({
      rule_kind: "prompt_rule" as const,
      agent: "all",
      rule_text: correctReplyHint
        ? `When the user asks similar questions, reply like: ${correctReplyHint}`
        : `Trainer correction: ${correctionBody}`.slice(0, 500),
    } satisfies ProposedTrainerFix)

  if (
    (proposal.rule_kind === "route_regex" ||
      proposal.rule_kind === "greeting_pattern") &&
    proposal.pattern &&
    !isSafeLearnedPattern(proposal.pattern)
  ) {
    proposal.rule_kind = "prompt_rule"
    proposal.pattern = undefined
    proposal.route_action = undefined
  }

  const learnedRuleId = await insertLearnedRule({
    ruleKind: proposal.rule_kind,
    agent: proposal.agent ?? "all",
    pattern: proposal.pattern ?? null,
    routeAction: proposal.route_action ?? null,
    ruleText: proposal.rule_text.trim(),
    sourceUserText: targetUserQuestion ?? correctionBody,
  }).catch(() => null)

  const userQuestion =
    proposal.user_question?.trim() || targetUserQuestion || null

  let fixedReply = correctReplyHint
  if (userQuestion) {
    const turn: UserTurn = { text: userQuestion, media: [] }
    const rerun = await runMasterConversation(input.conversationId, turn, {
      customerName: input.customerName,
      preview: true,
    })
    const rerunReply = outboundReply(rerun)
    if (rerunReply) fixedReply = rerunReply
  }

  const sendFixed = shouldSendTrainerFixedPreview(
    history,
    input.correctionText,
    tail
  )

  return {
    ok: true,
    learnedRuleId,
    targetUserQuestion: userQuestion,
    fixedReply: fixedReply || undefined,
    sendFixed: sendFixed && Boolean(fixedReply?.trim()),
    skipReason: sendFixed
      ? undefined
      : "Latest conversation turn is from the user — not sending corrected reply.",
  }
}
