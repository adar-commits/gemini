import { NextResponse } from "next/server"
import { isAuthorized } from "@/lib/agents/auth"
import { isCronAuthorized } from "@/lib/agents/cron-auth"
import { syncStreetsToSupabase } from "@/lib/address-fixer/sync"

export const runtime = "nodejs"
export const maxDuration = 300

/** Weekly: data.gov.il street list -> Supabase il_streets. */
export async function GET(request: Request) {
  if (!isCronAuthorized(request) && !isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await syncStreetsToSupabase()
    return NextResponse.json(result, { status: result.ok ? 200 : 500 })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
