/** Max risk_score for auto-implement without operator approval (default 9). */
export function qaAutoImplementRiskMax() {
  const raw = Number(process.env.QA_AUTOMATION_AUTO_IMPLEMENT_RISK_MAX ?? "9")
  if (!Number.isFinite(raw)) return 9
  return Math.min(10, Math.max(5, Math.round(raw)))
}

/**
 * Short policy block included on every QA webhook payload so the automation
 * defaults to self-improve unless the issue is genuinely ambiguous.
 */
export function qaAutonomyPolicyBlock() {
  const riskMax = qaAutoImplementRiskMax()
  return [
    `AUTONOMY DEFAULT — implement alone when the bug and fix are clear. The operator is busy.`,
    `FORBIDDEN: ask_operator / too_risky to confirm a fix you already wrote in fix_plan ("האם לתקן?", "לאשר?"). Log outcome chained and implement.`,
    `ask_operator ONLY for critical Hebrew BUSINESS POLICY forks with no KB (hours open/closed, refund rules, sales vs service routing) — max 1 MCQ.`,
    `If fix_layer + fix_plan exist and confidence is high|medium → ALWAYS outcome chained. Never stop for lame questions.`,
    `risk_score ≤ ${riskMax} + fix_layer prompt|hints|tool_guard|pre_turn|runtime + confidence high|medium → chained + implement in same run.`,
    `too_risky ONLY for: gender (לך/לכם), customer-facing meaning/tone change, or risk_score ≥ ${riskMax + 1} with wording change.`,
    `When in doubt → chained (implement). Server auto-continues obvious fixes without operator.`,
  ].join("\n")
}
