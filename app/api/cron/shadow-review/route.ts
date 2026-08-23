import { NextResponse } from "next/server"
import { isAuthorized } from "@/lib/agents/auth"
import {
  listRecentShadowIssues,
  runShadowReviewBatch,
  shadowReviewStats,
} from "@/lib/landbot/shadow-review"

export const maxDuration = 300
export const runtime = "nodejs"

function isCronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false
  const header = request.headers.get("authorization") ?? ""
  return header === `Bearer ${secret}`
}

async function handleRun() {
  const result = await runShadowReviewBatch()
  return NextResponse.json(result)
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
    const [stats, issues] = await Promise.all([
      shadowReviewStats(),
      listRecentShadowIssues(15),
    ])
    return NextResponse.json({
      ok: true,
      stats,
      recent_issues: issues,
      run: "POST /api/cron/shadow-review to process pending logs now",
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
    return handleRun()
  } catch (error) {
    const message = error instanceof Error ? error.message : "Shadow review failed"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
