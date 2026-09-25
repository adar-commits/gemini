import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { enrichHandoffReply } from "@/lib/agents/human-agent-hours"
import { CUSTOMER_HEADER } from "@/lib/agents/types"
import { buildHomAgentSystemPrompt } from "@/lib/hom-agent/prompt"

const body = "היי\nקנינו שטיח הסניף ראשלצ ומעוניינים במידה גדולה יותר. מה עלי לעשות?"

/** 532711282 — first message before hours got only "אין יועצי מכירות זמינים" instead of help. */
describe("after hours: help first 532711282", () => {
  it("tells the model which rep teams are offline right now", () => {
    const wed1900 = new Date("2026-09-09T16:00:00.000Z")
    const prompt = buildHomAgentSystemPrompt({ history: [], userText: body, now: wed1900 })
    assert.match(prompt, /Human reps right now: service OFFLINE \(א'-ה' 09:00-16:00\), sales OFFLINE \(09:30-18:00\)/)
    assert.match(prompt, /you are the one on shift/)
    assert.match(prompt, /Do \*\*not\*\* hand off on the first message/)
  })

  it("shows teams online during working hours", () => {
    const wed1000 = new Date("2026-09-09T07:00:00.000Z")
    const prompt = buildHomAgentSystemPrompt({ history: [], userText: body, now: wed1000 })
    assert.match(prompt, /service online .*sales online/)
  })

  it("keeps the exchange answer when the advisor handoff happens after hours", () => {
    const wed1900 = new Date("2026-09-09T16:00:00.000Z")
    const answer = `${CUSTOMER_HEADER}\nאפשר להחליף למידה גדולה יותר בכל אחד מסניפי הרשת, תוך 14 יום, ללא שימוש ובאריזה המקורית.`
    const reply = enrichHandoffReply(answer, "human_sales", wed1900)
    assert.match(reply, /אפשר להחליף למידה גדולה יותר/)
    assert.match(reply, /אין יועצי מכירות זמינים/)
    assert.ok(reply.indexOf("אפשר להחליף") < reply.indexOf("אין יועצי"))
  })
})
