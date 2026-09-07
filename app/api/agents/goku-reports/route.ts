import { NextResponse } from "next/server"
import { isAuthorized } from "@/lib/agents/auth"
import {
  approveGokuSuggestion,
  getGokuReport,
  listGokuReports,
} from "@/lib/agents/goku-trainer"

export const runtime = "nodejs"

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const reportId = url.searchParams.get("report_id")?.trim()
    if (reportId) {
      const report = await getGokuReport(reportId)
      if (!report) {
        return NextResponse.json({ ok: false, error: "Report not found" }, { status: 404 })
      }
      return NextResponse.json({ ok: true, report })
    }

    const limitRaw = Number(url.searchParams.get("limit") ?? "20")
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 20
    const conversationId = url.searchParams.get("conversation_id")?.trim()
    const reports = await listGokuReports({ limit, conversationId })
    return NextResponse.json({ ok: true, reports })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list GOKU reports"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = (await request.json()) as {
      report_id?: string
      suggestion_id?: string
    }
    const reportId = body.report_id?.trim()
    const suggestionId = body.suggestion_id?.trim()
    if (!reportId || !suggestionId) {
      return NextResponse.json(
        { ok: false, error: "report_id and suggestion_id are required" },
        { status: 400 }
      )
    }

    const result = await approveGokuSuggestion({
      reportId,
      suggestionId,
    })
    return NextResponse.json(result)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to approve GOKU suggestion"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
