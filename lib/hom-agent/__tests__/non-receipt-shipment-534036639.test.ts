import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { isShippingStatusQuestion } from "@/lib/agents/shipping"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const OPENING = "לא קיבלתי את המשלוח"

const BAD_FAQ_REPLY =
  "*הום בוט :)*\nבדקתי, סטטוס ההזמנה במערכת: הושלם. שמחתי לעזור!"

/** Replay 534036639 — FAQ must not warm-close on non-receipt shipment opener. */
describe("non-receipt shipment opener 534036639", () => {
  it("classifies לא קיבלתי את המשלוח as shipping status", () => {
    assert.equal(isShippingStatusQuestion(OPENING), true)
  })

  it("prompt teaches lookup — not הושלם + שמחתי לעזור", () => {
    const line = prompt
      .split("\n")
      .find((l) => l.includes("534036639") && l.includes("לא קיבלתי את המשלוח"))
    assert.ok(line, "missing 534036639 non-receipt shipment rule")
    assert.match(line!, /lookup_order_status/)
    assert.match(line!, /שמחתי לעזור/)
  })

  it("hints order-status opening on first turn", () => {
    const history: HistoryMessage[] = [{ role: "user", content: OPENING }]
    const hints =
      buildConversationHints({
        body: OPENING,
        history,
      }) ?? ""
    assert.match(hints, /534036639/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /שמחתי לעזור/)
  })

  it("bad FAQ reply pattern is not the taught path", () => {
    assert.match(BAD_FAQ_REPLY, /שמחתי לעזור/)
    assert.match(BAD_FAQ_REPLY, /הושלם/)
  })
})
