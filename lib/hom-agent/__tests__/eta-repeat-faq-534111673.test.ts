import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import {
  isDeliveryEstimateQuestion,
  isOrderLookupCompletedInThread,
  isShippingThreadFromHistory,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const ETA_OPENER = "מה הצפי? עד מתי היא אמורה להגיע?"
const FAQ_REPLY =
  "*הום בוט :)* כרגע אין במערכת תאריך אספקה מדויק. ההזמנה עדיין נארזת במחסן, ואחרי שהיא תימסר לחברת השליחויות, השליח ייצור קשר ביום האספקה עצמו, לקראת ההגעה."
const REPEAT_ASK = "מה מועד האספקה?"
const BAD_HANDOFF =
  "*הום בוט :)* אין לי תאריך אספקה מדויק להזמנה הזו, כי היא עדיין נארזת במחסן. אם תרצו, אעביר את הפנייה לנציג שירות שיבדוק מול המחסן את הצפi המדויק. להעביר?"

/** Replay 534111673 — repeat ETA after generic FAQ must lookup, not handoff. */
describe("ETA repeat FAQ 534111673", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: ETA_OPENER },
    { role: "assistant", content: FAQ_REPLY },
  ]

  it("detects delivery estimate phrasing including מועד האספקה", () => {
    assert.equal(isDeliveryEstimateQuestion(ETA_OPENER), true)
    assert.equal(isShippingThreadFromHistory(history), true)
    assert.equal(isOrderLookupCompletedInThread(history), false)
    assert.match(REPEAT_ASK, /מועד\s+האספקה/)
  })

  it("hints lookup_order_status — not handoff before lookup", () => {
    const hints = buildConversationHints({ body: REPEAT_ASK, history }) ?? ""
    assert.match(hints, /REPEAT ETA AFTER FAQ \(534111673\)/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /never repeat the same FAQ/)
    assert.doesNotMatch(hints, /human_service.*before lookup/i)
  })

  it("prompt teaches repeat ETA after FAQ without lookup", () => {
    const line = prompt
      .split("\n")
      .find((l) => l.includes("534111673") && l.includes("ETA repeat after FAQ"))
    assert.ok(line, "missing ETA repeat after FAQ rule for 534111673")
    assert.match(line!, /lookup_order_status/)
    assert.match(line!, /מועד האספקה/)
  })

  it("bad reply offered handoff without lookup", () => {
    assert.match(BAD_HANDOFF, /להעביר\?/)
    assert.match(BAD_HANDOFF, /נארז.*מחסן/)
    assert.doesNotMatch(BAD_HANDOFF, /בדקתי/)
  })
})
