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
    `AUTONOMY DEFAULT — implement alone when the bug and fix are clear.`,
    `Only ask_operator when Hebrew business policy is truly unresolved (two valid policies, no KB).`,
    `Do NOT ask the operator to confirm an obvious prompt/hints/runtime fix you already identified.`,
    `risk_score ≤ ${riskMax} + fix_layer prompt|hints|tool_guard|pre_turn|runtime + confidence high|medium → log outcome chained and implement.`,
    `too_risky / ask_operator only for: gender forms (לך/לכם), customer-facing meaning change, routing policy fork, or risk_score ≥ ${riskMax + 1}.`,
    `When in doubt between ask_operator and a safe prompt/hints fix → chained (implement).`,
  ].join("\n")
}
