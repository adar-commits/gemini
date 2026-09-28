import { qaAutoImplementRiskMax } from "@/lib/landbot/qa-autonomy-policy"

const AUTO_FIX_LAYERS = new Set([
  "prompt",
  "hints",
  "tool_guard",
  "pre_turn",
  "runtime",
])

export type QaImplementGateInput = {
  fixLayer: string | null
  fixPlan: string[]
  confidence: string | null
  riskScore: number | null
}

export function qaImplementGatePasses(input: QaImplementGateInput): boolean {
  if (!input.fixLayer || !AUTO_FIX_LAYERS.has(input.fixLayer)) return false
  if (!input.fixPlan.length || input.fixPlan.length > 3) return false
  if (input.confidence !== "high" && input.confidence !== "medium") return false
  const max = qaAutoImplementRiskMax()
  if (input.riskScore != null && input.riskScore > max) return false
  if (fixPlanTouchesCriticalWording(input.fixPlan)) return false
  return true
}

/** Gender / tone / meaning rewrites — operator must approve. */
export function fixPlanTouchesCriticalWording(fixPlan: string[] = []) {
  const blob = (fixPlan ?? []).join(" ")
  return /(?:לך\/לכם|מגדר|\bgender\b|לשנות.*(?:ניסוח|טון|משמעות)|customer-facing meaning)/i.test(
    blob
  )
}

const LAME_QUESTION_RES = [
  /(?:לאשר|מאשר|approve).*?(?:תיקון|fix)/i,
  /(?:האם|האם כדאי|האם נכון).*?(?:לתקן|להמשיך|fix)/i,
  /(?:should we|continue with).*?fix/i,
  /^(?:כן\/לא|להמשיך\?)/i,
  /(?:נכון ש).*?(?:לתקן|fix)/i,
  /(?:לתקן|fix)\s*\?/i,
]

/** "Should we fix this?" — not a policy fork. */
export function isLameOperatorQuestion(question: string) {
  const q = question.trim()
  if (!q) return false
  return LAME_QUESTION_RES.some((re) => re.test(q))
}

/** Hebrew business policy fork — hours, department, refund rules, etc. */
export function isCriticalPolicyQuestion(question: string) {
  const q = question.trim()
  if (!q || isLameOperatorQuestion(q)) return false
  return /(?:שעות|סגור|פתוח|מדיניות|\bpolicy\b|מחלקה|sales|service|החזר|refund|FAQ|שילוח|משלוח|אחריות|warranty)/i.test(
    q
  )
}

export type QaOperatorWaitInput = QaImplementGateInput & {
  outcome: string
  operatorQuestions: string[]
}

/**
 * True only when the operator must answer before implement — critical policy ambiguity
 * or high-risk wording change. Obvious prompt/hints/runtime fixes with lame MCQs → false.
 */
export function shouldWaitForOperator(input: QaOperatorWaitInput) {
  const gate = qaImplementGatePasses(input)
  const { outcome, operatorQuestions } = input

  if (
    outcome === "chained" ||
    outcome === "false_alarm" ||
    outcome === "already_covered" ||
    outcome === "no_action" ||
    outcome === "implemented"
  ) {
    return false
  }

  const hasCriticalQuestion = operatorQuestions.some(isCriticalPolicyQuestion)
  const allLameOrEmpty =
    operatorQuestions.length === 0 ||
    operatorQuestions.every(isLameOperatorQuestion)

  if (outcome === "ask_operator") {
    if (!input.fixLayer && !input.fixPlan.length) return true
    if (hasCriticalQuestion) return true
    if (gate && allLameOrEmpty) return false
    if (gate) return false
    return operatorQuestions.length > 0
  }

  if (outcome === "too_risky") {
    const max = qaAutoImplementRiskMax()
    if (fixPlanTouchesCriticalWording(input.fixPlan)) return true
    if (input.riskScore != null && input.riskScore > max) {
      if (hasCriticalQuestion) return true
      if (gate && allLameOrEmpty) return false
      return true
    }
    if (gate && !hasCriticalQuestion) return false
    return hasCriticalQuestion
  }

  if (outcome === "real_failure") {
    if (operatorQuestions.length === 0) return false
    if (hasCriticalQuestion) return true
    if (gate && allLameOrEmpty) return false
    return operatorQuestions.some((q) => !isLameOperatorQuestion(q))
  }

  return false
}

export function coerceQaAnalyzeOutcome(input: QaOperatorWaitInput) {
  const unchanged = {
    outcome: input.outcome,
    operatorQuestions: input.operatorQuestions,
    autoContinue: false as const,
    reason: "unchanged" as const,
  }

  if (
    input.outcome === "false_alarm" ||
    input.outcome === "already_covered" ||
    input.outcome === "no_action" ||
    input.outcome === "chained" ||
    input.outcome === "failed_guard"
  ) {
    return unchanged
  }

  if (shouldWaitForOperator(input)) {
    return {
      outcome: input.outcome,
      operatorQuestions: input.operatorQuestions,
      autoContinue: false as const,
      reason: "critical_operator_wait" as const,
    }
  }

  const canAutoChain =
    qaImplementGatePasses(input) ||
    input.outcome === "real_failure" ||
    input.outcome === "ask_operator" ||
    input.outcome === "too_risky"

  if (!canAutoChain) return unchanged

  return {
    outcome: "chained" as const,
    operatorQuestions: [] as string[],
    autoContinue: true as const,
    reason: "auto_implement_gate" as const,
  }
}
