import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { isDesignCenterLocationQuestion } from "@/lib/agents/branches"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

/** 533900683 — "Are you inside design center?" bot assumed Kiryat Ata and asked which design center. */
describe("design center location 533900683", () => {
  const opening = "הייhi\nAre you inside design center ?"
  const history: HistoryMessage[] = [
    { role: "user", content: "הייhi", agent: null },
    { role: "user", content: "Are you inside design center ?", agent: null },
  ]

  it("detects design-center location question", () => {
    assert.equal(isDesignCenterLocationQuestion("Are you inside design center ?"), true)
    assert.equal(isDesignCenterLocationQuestion("האם אתם במרכז עיצוב?"), true)
    assert.equal(isDesignCenterLocationQuestion("מה כתובת סניף נתניה?"), false)
  })

  it("prompt teaches yes/no design-center location, not which-complex disambiguation", () => {
    const line = prompt
      .split("\n")
      .find((l) => l.includes("Design-center location vs named branch"))
    assert.ok(line, "missing design-center location rule")
    assert.match(prompt, /533900683/)
    assert.match(prompt, /never.*Which design center did you mean/i)
  })

  it("hints FAQ yes/no answer and no single-branch assumption", () => {
    const hints = buildConversationHints({
      history,
      body: "Are you inside design center ?",
      whatsappPhone: "+972547495083",
    })
    assert.notEqual(hints, null)
    assert.match(hints!, /DESIGN-CENTER LOCATION FAQ \(533900683\)/)
    assert.match(hints!, /never "Which design center did you mean\?"/)
    assert.match(hints!, /action: reply/)
  })
})
