import { NextResponse } from "next/server"
import { isAuthorized } from "@/lib/agents/auth"
import {
  getRuntimeConfig,
  saveRuntimeConfig,
  runtimeConfigSnapshot,
  invalidateRuntimeConfigCache,
} from "@/lib/agent-core/runtime-config"
import type { ProfileName } from "@/lib/agent-core/model-profiles"
import type { AgentRoutingMode } from "@/lib/agent-core/routing-mode"
import type { OrchestraMode } from "@/lib/agent-core/model-orchestra"

export async function GET() {
  const config = await getRuntimeConfig(true)
  return NextResponse.json({ ok: true, ...runtimeConfigSnapshot(config) })
}

export async function PATCH(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  let body: {
    activeProfile?: ProfileName
    routingMode?: AgentRoutingMode
    debounceMs?: number
    historyLimit?: number
    orchestraMode?: OrchestraMode
    updatedBy?: string
  } = {}

  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 })
  }

  try {
    const config = await saveRuntimeConfig({
      activeProfile: body.activeProfile,
      routingMode: body.routingMode,
      debounceMs: body.debounceMs,
      historyLimit: body.historyLimit,
      orchestraMode: body.orchestraMode,
      updatedBy: body.updatedBy ?? "api",
    })
    invalidateRuntimeConfigCache()
    return NextResponse.json({ ok: true, ...runtimeConfigSnapshot(config) })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
