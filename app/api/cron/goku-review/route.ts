import { NextResponse } from "next/server"
import { isAuthorized } from "@/lib/agents/auth"
import { gokuStats, runGokuReviewBatch } from "@/lib/landbot/goku-review"

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
    const result = await runGokuReviewBatch()
    const stats = await gokuStats()
    return NextResponse.json({ ...result, ok: true, stats })
  } catch (error) {
    const message = error instanceof Error ? error.message : "GOKU review failed"
    console.error("[goku] batch failed", message)
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
    return NextResponse.json({ ok: true, stats: await gokuStats() })
  } catch (error) {
    const message = error instanceof Error ? error.message : "GOKU status failed"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!isCronAuthorized(request) && !isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }
  return handleRun()
}
