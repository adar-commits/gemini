import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildDissatisfactionRescuePortalReply,
  buildDissatisfactionRescueReply,
} from "@/lib/agents/dissatisfaction"
import { inferHumanHandoffAction } from "@/lib/agents/off-topic"
import { resolveCrmDepartmentForTurn } from "@/lib/crm/conversation-department"
import { runPreTurnGuards } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

/** Replay 424358153 — return portal code + service handoff confirm must not assign sales. */
describe("return portal service handoff 424358153", () => {
  const serviceOffer =
    "*הום בוט :)*\nמצטערים על התקלה. האם להעביר את הפנייה לנציג שירות שיוכל לעזור עם קוד הפורטל?"

  const history: HistoryMessage[] = [
    {
      role: "user",
      content: "השטיח קטן מידי, תעזור לי לבחור דגם אחר",
    },
    { role: "assistant", content: buildDissatisfactionRescueReply() },
    { role: "user", content: "החזרה" },
    { role: "assistant", content: buildDissatisfactionRescuePortalReply() },
    { role: "user", content: "לא קיבלתי קוד מהפורטל" },
    { role: "assistant", content: serviceOffer },
  ]

  it("binds pending service offer before whole-thread sales scan", () => {
    assert.equal(inferHumanHandoffAction(history, null), "human_service")
  })

  it("assigns human_service on כן תודה — not יועצי מכירות", () => {
    const result = runPreTurnGuards({
      turn: { text: "כן תודה", media: [] },
      history,
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "human_service")
    assert.match(result.reply, /נציג שירות|שירות/)
    assert.doesNotMatch(result.reply, /יועץ מכירות|יועצי מכירות/)
    assert.equal(
      resolveCrmDepartmentForTurn({ history, body: "כן תודה" })?.department,
      "service"
    )
  })
})
