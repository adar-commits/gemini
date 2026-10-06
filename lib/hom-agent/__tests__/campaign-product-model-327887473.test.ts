import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { isCampaignQuestion } from "@/lib/agents/campaign-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"

const OPENING = "היי ה50% באתר על שטיח סידני 02 נגמר?"
const BAD_REPLY =
  "לא הצלחתי לבדוק כרגע את המבצעים במערכת, ולכן אין לי איך לדעת אם ה-50% על סידני 02 עדיין בתוקף."

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

/** 327887473 — customer asked if 50% on Sydney 02 ended; bot skipped get_campaigns and handed off. */
describe("campaign validity with product model 327887473", () => {
  it("detects the opening as a campaign question", () => {
    assert.equal(isCampaignQuestion(OPENING), true)
  })

  it("hints get_campaigns instead of blind handoff", () => {
    const hints = buildConversationHints({ history: [], body: OPENING }) ?? ""
    assert.match(hints, /get_campaigns/i)
    assert.match(hints, /327887473/)
    assert.match(hints, /Never say לא הצלחתי לבדוק/)
  })

  it("teaches calling get_campaigns before handoff for product-specific sale %", () => {
    const line = prompt.split("\n").find((l) => l.includes("327887473"))
    assert.ok(line, "missing prompt rule for 327887473")
    assert.match(line!, /get_campaigns/)
    assert.match(line!, /never.*human_sales/i)
  })

  it("documents the failure mode to avoid", () => {
    assert.match(BAD_REPLY, /לא הצלחתי לבדוק/)
    assert.match(BAD_REPLY, /סידני 02/)
  })
})
