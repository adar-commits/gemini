import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { isServiceHandoffSummaryText } from "@/lib/agents/service-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const BAD_SUMMARY =
  "*הום בוט :)*\nכדי שהנציג לא יצטרך לשאול שוב, זה מה שאעביר לו:\n• מס׳ הזמנה: ⁦#76849⁩\n• פנייה לשירות לקוחות\n• משך ההמתנה: שבוע\n\nזה מדויק, או שחסר משהו?"

function historyThroughOrderConfirm(): HistoryMessage[] {
  return [
    { role: "user", content: "0509310306 המספר של בעלי" },
    { role: "user", content: "נאור כהן" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* מצאתי הזמנה שבוצעה לפני 24 ימים באתר אינטרנט, על סך 612.75 ש״ח. זו ההזמנה? (מס׳ הזמנה ⁦#76849⁩)",
      awaiting: "order_confirm",
    },
    { role: "user", content: "כן" },
  ]
}

/** Replay 534367153 — phone-only lookup + order confirm must not open invented service summary. */
describe("phone lookup no issue stated (534367153)", () => {
  it("detects the bad production summary with invented wait duration", () => {
    assert.equal(isServiceHandoffSummaryText(BAD_SUMMARY), true)
    assert.match(BAD_SUMMARY, /משך ההמתנה: שבוע/)
    assert.match(BAD_SUMMARY, /פנייה לשירות לקוחות/)
  })

  it("prompt teaches ask issue before rep summary when no problem stated", () => {
    const line = prompt
      .split("\n")
      .find((l) => l.includes("534367153") && l.includes("no issue stated"))
    assert.ok(line, "missing 534367153 no-issue-stated rule")
    assert.match(line!, /Never.*service rep summary/i)
    assert.match(line!, /משך ההמתנה/)
  })

  it("hints ask for the issue instead of service rep summary after order confirm", () => {
    const history = historyThroughOrderConfirm().slice(0, -1)
    const hints = buildConversationHints({ history, body: "כן" }) ?? ""
    assert.match(hints, /534367153/)
    assert.match(hints, /never described the problem/i)
    assert.match(hints, /Never service rep summary/i)
    assert.match(hints, /Never invent issue labels/i)
    assert.doesNotMatch(hints, /SERVICE ORDER ID/)
  })
})
