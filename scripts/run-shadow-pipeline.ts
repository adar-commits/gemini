/**
 * Drain unreviewed shadow logs and apply autofix learned rules.
 * Usage: set -a && source .env.local && set +a && npx tsx scripts/run-shadow-pipeline.ts
 */
async function main() {
  const { runShadowReviewBatch } = await import("../lib/landbot/shadow-review")
  const { runShadowAutofixBatch } = await import("../lib/landbot/shadow-autofix")
  const { shadowReviewStats } = await import("../lib/landbot/shadow-review")
  const { learnedRuleStats } = await import("../lib/agents/learned-rules")

  let reviewTotal = 0
  let issueTotal = 0
  let reviewRuns = 0

  for (let i = 0; i < 30; i += 1) {
    const stats = await shadowReviewStats()
    if ((stats.pending ?? 0) <= 0) break

    const review = await runShadowReviewBatch()
    reviewRuns += 1
    reviewTotal += review.reviewed ?? 0
    issueTotal += review.issues ?? 0

    console.log(
      `Review run ${reviewRuns}: reviewed=${review.reviewed} issues=${review.issues} pending~=${stats.pending}`
    )

    if ((review.reviewed ?? 0) === 0) break
  }

  let autofixTotal = 0
  let autofixRuns = 0

  for (let i = 0; i < 20; i += 1) {
    const autofix = await runShadowAutofixBatch()
    autofixRuns += 1
    autofixTotal += autofix.applied ?? 0
    console.log(`Autofix run ${autofixRuns}: applied=${autofix.applied ?? 0}`)
    if ((autofix.applied ?? 0) === 0) break
  }

  const [finalStats, learned] = await Promise.all([
    shadowReviewStats(),
    learnedRuleStats(),
  ])

  console.log(
    JSON.stringify(
      {
        ok: true,
        review_runs: reviewRuns,
        reviewed_total: reviewTotal,
        issues_total: issueTotal,
        autofix_runs: autofixRuns,
        autofix_applied_total: autofixTotal,
        final_stats: finalStats,
        active_learned_rules: learned.active_rules,
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
