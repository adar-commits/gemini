import { NextResponse } from "next/server"
import { isAuthorized } from "@/lib/agents/auth"
import { runAgent, runMasterConversation } from "@/lib/agents/run-agent"
import { AGENT_IDS, type AgentId } from "@/lib/agents/types"

export const maxDuration = 60
export const runtime = "nodejs"

function isAgentId(value: string): value is AgentId {
  return (AGENT_IDS as readonly string[]).includes(value)
}

function readRequest(payload: Record<string, unknown>) {
  const conversationId = [
    payload.conversation_id,
    payload.conversationId,
    payload.session_id,
    payload.sessionId,
  ]
    .map((value) => (typeof value === "string" || typeof value === "number" ? String(value).trim() : ""))
    .find(Boolean)

  const body = [payload.body, payload.message, payload.text]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .find(Boolean)

  return { conversationId, body }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ agent: string }> }
) {
  const { agent } = await context.params
  if (!isAgentId(agent)) {
    return NextResponse.json(
      { ok: false, error: `Unknown agent. Use ${AGENT_IDS.join(", ")}.` },
      { status: 404 }
    )
  }
  return NextResponse.json({
    ok: true,
    agent,
    method: "POST",
    expect: ["conversation_id", "body"],
    note:
      agent === "master"
        ? "Landbot should POST here only. Master routes internally to faq, sales, or service and returns their reply."
        : "Direct specialist endpoint for debugging. Production should POST /api/agents/master.",
  })
}

export async function POST(
  request: Request,
  context: { params: Promise<{ agent: string }> }
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const { agent } = await context.params
  if (!isAgentId(agent)) {
    return NextResponse.json(
      { ok: false, error: `Unknown agent. Use ${AGENT_IDS.join(", ")}.` },
      { status: 404 }
    )
  }

  let payload: Record<string, unknown> = {}
  try {
    payload = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 })
  }

  const { conversationId, body } = readRequest(payload)
  if (!conversationId || !body) {
    return NextResponse.json(
      { ok: false, error: "conversation_id and body are required" },
      { status: 400 }
    )
  }

  try {
    const result =
      agent === "master"
        ? await runMasterConversation(conversationId, body)
        : await runAgent(agent, conversationId, body)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent failed"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
