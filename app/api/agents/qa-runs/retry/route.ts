import { NextResponse } from "next/server"
import { isAuthorized } from "@/lib/agents/auth"
import { getQaAutomationRunById } from "@/lib/agents/qa-automation-log"
import { getAgentSupabase } from "@/lib/agents/supabase"
import { canRetryQaRun, retryQaAutomationRun } from "@/lib/landbot/qa-run-retry"

export const runtime = "nodejs"

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const id = url.searchParams.get("id")?.trim()
  if (id) {
    const run = await getQaAutomationRunById(id)
    if (!run) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 })
    }
    return NextResponse.json({
      ok: true,
      id: run.id,
      session_id: run.session_id,
      outcome: run.outcome,
      phase: run.phase,
      updated_at: run.updated_at,
      retryable: canRetryQaRun(run),
    })
  }

  const since = url.searchParams.get("since")?.trim()
  const outcome = url.searchParams.get("outcome")?.trim() || "webhook_failed"
  if (!since) {
    return NextResponse.json(
      {
        ok: false,
        error: "Provide ?id= for one run or ?since= ISO timestamp to list failed runs",
      },
      { status: 400 }
    )
  }

  const supabase = getAgentSupabase()
  const { data, error } = await supabase
    .from("hom_agent_qa_runs")
    .select("id, session_id, trigger, created_at, updated_at")
    .eq("outcome", outcome)
    .gte("created_at", since)
    .order("created_at", { ascending: true })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    since,
    outcome,
    total: data?.length ?? 0,
    runs: data ?? [],
  })
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 })
  }

  const id = String(body.id ?? "").trim()
  if (!id) {
    return NextResponse.json({ ok: false, error: "missing id" }, { status: 400 })
  }

  const result = await retryQaAutomationRun(id)
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
  }

  return NextResponse.json({ ok: true, id })
}
