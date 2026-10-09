import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { isDeliveryEstimateQuestion } from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const OPENER =
  "יש צפי מתי אמור להגיע? כי כתוב שהועמס על ידי שליח כבר לפני יומיים"
const BAD_REPLY =
  "*הום בוט :)* הילה, אין במערכת שעה או תאריך מדויק למסירה. הסטטוס \"הועמס לשליח\" הוא השלב האחרון לפני המסירה, ולכן השטיח אמור להגיע אלייך ממש בקרוב. בכיף, המשך יום נעים"

/** Replay 532005744 — ETA + stale courier status must lookup, not FAQ end. */
describe("stale courier ETA 532005744", () => {
  const history: HistoryMessage[] = []

  it("detects delivery estimate opener with courier delay", () => {
    assert.equal(isDeliveryEstimateQuestion(OPENER), true)
    assert.match(OPENER, /הועמס/)
    assert.match(OPENER, /יומיים/)
  })

  it("hints lookup_order_status on first turn — not FAQ-only close", () => {
    const hints = buildConversationHints({ body: OPENER, history }) ?? ""
    assert.match(hints, /STALE COURIER LOADED ETA \(532005744\)/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /never generic FAQ-only \+ action end/)
  })

  it("prompt teaches stale courier loaded ETA opener", () => {
    const line = prompt
      .split("\n")
      .find((l) => l.includes("532005744") && l.includes("Stale courier loaded"))
    assert.ok(line, "missing stale courier ETA rule for 532005744")
    assert.match(line!, /lookup_order_status/)
    assert.match(line!, /action: end/)
  })

  it("bad reply closed without lookup", () => {
    assert.match(BAD_REPLY, /הועמס לשליח/)
    assert.doesNotMatch(BAD_REPLY, /בדקתי/)
    assert.match(BAD_REPLY, /בכיף/)
  })
})
