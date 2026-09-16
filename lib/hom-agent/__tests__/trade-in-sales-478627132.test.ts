import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { selectFaqKb } from "@/lib/agents/kb"
import { isTradeInQuestion } from "@/lib/agents/inquiry-intent"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

/** Replay 478627132 — sales inquiry + trade-in must not invent repair or return policy. */
describe("trade-in in sales inquiry (478627132)", () => {
  const opener =
    "בנוסף אם יש לכם שטיח כזה והאם יש אופציה של טרייד אין"

  it("detects trade-in phrasing", () => {
    assert.equal(isTradeInQuestion(opener), true)
    assert.equal(isTradeInQuestion("trade in"), true)
  })

  it("includes trade-in KB grounding", () => {
    const kb = selectFaqKb(opener)
    assert.match(kb, /Trade-in|trade-in|טרייד/i)
    assert.match(kb, /Never invent alternatives/)
    assert.match(kb, /Never.*repair|תיקון שטיחים/)
  })

  it("hints forbid repair pivot and policy dump", () => {
    const history: HistoryMessage[] = [
      {
        role: "user",
        content:
          "היי אשמח לפרטים נוספים לגבי שטיח קילים סקנדינבי 21 שחור/פודרה/אפור עם פרנזים KILIM",
      },
      { role: "user", content: "בגודל 2 על 2" },
    ]
    const hints = buildConversationHints({
      body: opener,
      history,
      whatsappPhone: "+972500000000",
    })
    assert.notEqual(hints, null)
    assert.match(hints!, /TRADE-IN \(478627132\)/)
    assert.match(hints!, /Never mention תיקון/)
    assert.match(hints!, /continue sales intake/)
  })
})
