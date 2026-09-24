import { NextResponse } from "next/server"
import { isQaChainAuthorized } from "@/lib/landbot/qa-chain-auth"
import {
  chainQaImplement,
  parseChainQaImplementBody,
  qaChainImplementEnvStatus,
} from "@/lib/landbot/qa-chain-implement"
import { internalApiOrigin } from "@/lib/landbot/sync-hook"

export async function GET() {
  const env = qaChainImplementEnvStatus()
  return NextResponse.json({
    ok: env.implement_url && env.implement_token && env.cron_secret,
    endpoint: `${internalApiOrigin()}/api/agents/qa-chain-implement`,
    env,
    analyze_automation_needs: {
      note: "No Secrets UI required — reuse this automation's inbound webhook Bearer token in step 7 curl",
    },
  })
}

export async function POST(request: Request) {
  if (!isQaChainAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = parseChainQaImplementBody(body)
  if (!parsed) {
    return NextResponse.json(
      { error: "Invalid analysis payload — see analysis-schema.json" },
      { status: 400 }
    )
  }

  const result = await chainQaImplement(parsed)
  const status = result.ok ? 200 : result.chained ? 502 : 503
  return NextResponse.json(result, { status })
}
