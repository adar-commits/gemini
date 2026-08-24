import { NextResponse } from "next/server"
import { isAuthorized } from "@/lib/agents/auth"
import {
  listRecentShadowIssues,
  runShadowReviewBatch,
  shadowReviewStats,
} from "@/lib/landbot/shadow-review"
import { runShadowAutofixBatch } from "@/lib/landbot/shadow-autofix"
import { learnedRuleStats } from "@/lib/agents/learned-rules"

export const maxDuration = 300
export const runtime = "nodejs"

function isCronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false
  const header = request.headers.get("authorization") ?? ""
  return header === `Bearer ${secret}`
}

async function handleRun() {
  try {
    const review = await runShadowReviewBatch()
    const autofix = await runShadowAutofixBatch()
    return NextResponse.json({ ok: true, review, autofix })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Shadow review failed"
    console.error("[shadow-review] batch failed", message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

/** Vercel Cron (GET + CRON_SECRET) or manual POST with AGENT_API_KEY */
export async function GET(request: Request) {
  if (isCronAuthorized(request)) {
    return handleRun()
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
    return await handleRun()
  } catch (error) {
    const message = error instanceof Error ? error.message : "Shadow review failed"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
