import { NextResponse } from "next/server"
import { isAuthorized } from "@/lib/agents/auth"
import { cronSecretStatus, isCronAuthorized } from "@/lib/agents/cron-auth"
import { processInactivityTimeouts } from "@/lib/landbot/inactivity-cron"

export const maxDuration = 60
export const runtime = "nodejs"

export async function GET(request: Request) {
  if (!isCronAuthorized(request) && !isAuthorized(request)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized",
        cron: cronSecretStatus(),
      },
      { status: 401 }
    )
  }

  try {
    const result = await processInactivityTimeouts()
    return NextResponse.json({ ok: true, result, cron: cronSecretStatus() })
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
