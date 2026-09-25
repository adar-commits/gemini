import { NextResponse } from "next/server"
import { isAuthorized } from "@/lib/agents/auth"
import { notifyViolationsToQa, runViolationScanner } from "@/lib/hom-agent/violation-scanner"

export const maxDuration = 120
export const runtime = "nodejs"

function isCronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false
  const header = request.headers.get("authorization") ?? ""
  return header === `Bearer ${secret}`
}

async function handleRun() {
  try {
    const result = await runViolationScanner({
      limit: 500,
      hours: 24,
      includeGoku: false,
      writeDrafts: process.env.VIOLATION_SCANNER_WRITE_DRAFTS?.trim() === "1",
    })
    const qa = await notifyViolationsToQa(result.violations)

    console.log("[violation-scanner] complete", {
      scanned: result.scanned,
      violations: result.violations.length,
      types: result.violations.reduce<Record<string, number>>((acc, row) => {
        acc[row.type] = (acc[row.type] ?? 0) + 1
        return acc
      }, {}),
      qa,
    })

    return NextResponse.json({
      ok: true,
      scanned: result.scanned,
      violationCount: result.violations.length,
      violations: result.violations.slice(0, 20),
      draftCount: result.draftContracts.length,
      qa,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Violation scan failed"
    console.error("[violation-scanner] failed", message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

/** Vercel Cron (GET + CRON_SECRET) or manual POST with AGENT_API_KEY */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }
  return handleRun()
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }
  return handleRun()
}
