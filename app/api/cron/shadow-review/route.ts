import { NextResponse } from "next/server"
import { isAuthorized } from "@/lib/agents/auth"
import {
  listRecentShadowIssues,
  resetFailedShadowReviews,
  runDeterministicShadowReviewBatch,
  runShadowReviewBatch,
  shadowReviewStats,
} from "@/lib/landbot/shadow-review"
import { runShadowAutofixDrain } from "@/lib/landbot/shadow-autofix"
import { learnedRuleStats } from "@/lib/agents/learned-rules"

export const maxDuration = 300
export const runtime = "nodejs"

function isCronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false
  const header = request.headers.get("authorization") ?? ""
  return header === `Bearer ${secret}`
}

async function drainDeterministic(maxLoops = 20) {
  let totalReviewed = 0
  let totalIssues = 0
  let totalOk = 0
  let loops = 0

  for (let i = 0; i < maxLoops; i += 1) {
    const stats = await shadowReviewStats()
    if ((stats.pending ?? 0) <= 0) break

    const drain = await runDeterministicShadowReviewBatch()
    loops += 1
    totalReviewed += drain.reviewed ?? 0
    totalIssues += drain.issues ?? 0
    totalOk += drain.ok_count ?? 0

    if ((drain.reviewed ?? 0) === 0) break
  }

  return {
    loops,
    reviewed: totalReviewed,
    issues: totalIssues,
    ok_count: totalOk,
  }
}

async function handleRun(request?: Request) {
  try {
    const autofixOnly =
      request != null && new URL(request.url).searchParams.get("mode") === "autofix"
    const reset =
      process.env.SHADOW_RESET_FAILED_REVIEWS?.trim() === "1"
        ? await resetFailedShadowReviews()
        : { deleted: 0 }

    const deterministic =
      autofixOnly || process.env.SHADOW_AUTOFIX_ONLY?.trim() === "1"
        ? { loops: 0, reviewed: 0, issues: 0, ok_count: 0, skipped: "autofix_only" as const }
        : await drainDeterministic()

    const autofix = await runShadowAutofixDrain()
    const review =
      autofixOnly || process.env.SHADOW_AUTOFIX_ONLY?.trim() === "1"
        ? { ok: true, skipped: "autofix_only", reviewed: 0, issues: 0 }
        : await runShadowReviewBatch()

    const stats = await shadowReviewStats()
    return NextResponse.json({ ok: true, reset, deterministic, autofix, review, stats })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Shadow review failed"
    console.error("[shadow-review] batch failed", message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

/** Vercel Cron (GET + CRON_SECRET) or manual POST with AGENT_API_KEY */
export async function GET(request: Request) {
  if (isCronAuthorized(request)) {
    return handleRun(request)
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const [stats, issues, learned] = await Promise.all([
      shadowReviewStats(),
      listRecentShadowIssues(15),
      learnedRuleStats(),
    ])
    return NextResponse.json({
      ok: true,
      stats,
      learned,
      recent_issues: issues,
      cron_secret_configured: Boolean(process.env.CRON_SECRET?.trim()),
      vercel_cron_hint:
        "Set CRON_SECRET in Vercel Production env and redeploy so scheduled crons authenticate.",
      run: "POST /api/cron/shadow-review with Authorization: Bearer $CRON_SECRET or AGENT_API_KEY",
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Shadow review status failed"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!isCronAuthorized(request) && !isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    return await handleRun(request)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Shadow review failed"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
