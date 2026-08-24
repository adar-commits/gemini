/**
 * Drain unreviewed shadow logs and apply autofix learned rules.
 * Usage: npx --yes dotenv-cli -e .env.production.local -- npx --yes tsx scripts/run-shadow-pipeline.ts
 */
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

function loadEnvFile(relativePath: string) {
  const path = join(process.cwd(), relativePath)
  if (!existsSync(path)) return
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq)
    if (process.env[key]?.trim()) continue
    let value = trimmed.slice(eq + 1)
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (value) process.env[key] = value
  }
}

loadEnvFile(".env.production.local")

async function main() {
  const { runShadowReviewBatch } = await import("../lib/landbot/shadow-review")
  const { runShadowAutofixDrain } = await import("../lib/landbot/shadow-autofix")
  const { shadowReviewStats, resetFailedShadowReviews } = await import(
    "../lib/landbot/shadow-review"
  )
  const { learnedRuleStats } = await import("../lib/agents/learned-rules")

  const reset = await resetFailedShadowReviews()
  console.log(`Reset failed reviews: ${reset.deleted}`)

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

  for (let i = 0; i < 30; i += 1) {
    const autofix = await runShadowAutofixDrain()
    autofixRuns += 1
    autofixTotal += autofix.total_applied ?? 0
    console.log(
      `Autofix drain ${autofixRuns}: applied=${autofix.total_applied ?? 0} loops=${autofix.loops ?? 0}`
    )
    if ((autofix.last_batch?.processed_issues ?? 0) === 0) break
  }

  const [finalStats, learned] = await Promise.all([
    shadowReviewStats(),
    learnedRuleStats(),
  ])

  console.log(
    JSON.stringify(
      {
        ok: true,
        reset_deleted: reset.deleted,
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
