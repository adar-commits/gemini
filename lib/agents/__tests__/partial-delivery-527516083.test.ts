import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"

/** Replay 527516083 — one of two rugs missing; must not close as full delivery on turn 1. */
describe("partial delivery opener 527516083", () => {
  const opening =
    "הי אחד השטיחים שהזמנתי לא הגיע והיה צפי הגעה לספטמבר"

  it("first-turn hint teaches partial delivery service path", () => {
    const hints = buildConversationHints({ history: [], body: opening }) ?? ""
    assert.match(hints, /527516083/i)
    assert.match(hints, /partial delivery opener/i)
    assert.match(hints, /never.*שמחתי לעזור/i)
  })

  it("hom-bot binds multi-item missing to service, not delivered close", () => {
    const prompt = readFileSync("lib/hom-agent/prompts/hom-bot.md", "utf8")
    assert.match(prompt, /527516083/)
    assert.match(prompt, /אחד השטיחים לא הגיע/)
  })
})
