import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { isRugCleaningServiceQuestion } from "@/lib/agents/policy-subjects"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"

/** Replay 532160407 / 0542115321 — rug cleaning FAQ must sound human, not corporate. */
describe("rug cleaning service FAQ tone (532160407)", () => {
  const body =
    "מבקשת לבדוק אם אתם מנקים שטיחים שאגי כולל נטרול ריח"

  it("detects in-house rug cleaning service questions", () => {
    assert.equal(isRugCleaningServiceQuestion(body), true)
    assert.equal(isRugCleaningServiceQuestion("איך מנקים כתם על שטיח?"), false)
    assert.equal(isRugCleaningServiceQuestion("מה מדיניות החזרה?"), false)
  })

  it("hints warm KB answer and bans robotic phrasing", () => {
    const hints = buildConversationHints({
      body,
      history: [],
      whatsappPhone: "0542115321",
    })
    assert.match(hints ?? "", /RUG CLEANING \/ CARE FAQ/i)
    assert.match(hints ?? "", /never.*אין לי מידע/i)
    assert.match(hints ?? "", /no proactive handoff/i)
    assert.match(hints ?? "", /dry cleaning|ניקוי יבש/i)
  })

  it("hom-bot prompt teaches human tone for rug cleaning FAQ", () => {
    const prompt = readFileSync(
      join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"),
      "utf8"
    )
    assert.match(prompt, /Rug cleaning service|ניקוי שטיחים/)
    assert.match(prompt, /אין לי מידע על/)
    assert.match(prompt, /שאלה טובה/)
  })
})
