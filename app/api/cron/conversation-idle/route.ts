import { NextResponse } from "next/server"
import { isAuthorized } from "@/lib/agents/auth"
import { processInactivityTimeouts } from "@/lib/landbot/inactivity-cron"

export const maxDuration = 60
export const runtime = "nodejs"

function isCronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false
  const header = request.headers.get("authorization") ?? ""
  return header === `Bearer ${secret}`
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request) && !isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await processInactivityTimeouts()
    return NextResponse.json({ ok: true, result })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Inactivity cron failed"
    console.error("[conversation-idle]", message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  return GET(request)
}
