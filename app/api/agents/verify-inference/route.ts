import { NextResponse } from "next/server"
import { isAuthorized } from "@/lib/agents/auth"
import {
  inferenceConfigSnapshot,
  runInferenceProbes,
} from "@/lib/agent-core/verify-inference"

export const maxDuration = 60
export const runtime = "nodejs"

/** Config only — safe to curl without auth (no LLM spend). */
export async function GET() {
  const config = await inferenceConfigSnapshot()
  return NextResponse.json({
    ok: true,
    ...config,
    liveProbe:
      "POST with Authorization (AGENT_API_KEY) to run gateway probes and return response.modelId",
  })
}

/** Runs real generateText probes against configured models. Costs a few tokens. */
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  let includeSales = false
  try {
    const body = (await request.json()) as { includeSales?: boolean }
    includeSales = Boolean(body?.includeSales)
  } catch {
    // empty body is fine
  }

  try {
    const result = await runInferenceProbes({ includeSales })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verify inference failed"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
