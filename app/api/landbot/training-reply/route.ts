import { NextResponse } from "next/server"
import { isAuthorized } from "@/lib/agents/auth"
import { sendTrainingReply } from "@/lib/landbot/training-reply"
import { trainerPhone } from "@/lib/landbot/trainer"

export const maxDuration = 60
export const runtime = "nodejs"

/** Run the agent on a sample message and WhatsApp the reply to the trainer. */
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 })
  }

  const userText = String(payload.userText ?? payload.message ?? payload.body ?? "").trim()
  if (!userText) {
    return NextResponse.json(
      { ok: false, error: "userText (or message/body) is required" },
      { status: 400 }
    )
  }

  try {
    const result = await sendTrainingReply({
      userText,
      phone: typeof payload.phone === "string" ? payload.phone : undefined,
      note: typeof payload.note === "string" ? payload.note : undefined,
      previewLabel:
        typeof payload.previewLabel === "string" ? payload.previewLabel : undefined,
      reset: Boolean(payload.reset),
      force: Boolean(payload.force),
    })
    if (result.skipped) {
      return NextResponse.json(result, { status: 409 })
    }
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Training reply failed"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  return NextResponse.json({
    ok: true,
    method: "POST",
    trainer_phone: trainerPhone(),
    body: {
      userText: "example customer message",
      note: "optional fix description",
      reset: "optional — clear agent memory before preview (avoid on active chats)",
      force: "optional — send even if the live conversation has moved on",
      phone: "optional — defaults to LANDBOT_TRAINER_PHONE",
    },
  })
}
