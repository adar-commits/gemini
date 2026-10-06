import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import {
  isKnownOrderConfirmPending,
  isShippingThreadFromHistory,
  orderIdGivenInThread,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const ETA_OPENER = "לגבי תאריך אספקה..."
const BOT_CONFIRM =
  "*הום בוט :)*\nהיי מיקה! לגבי מועד האספקה, מדובר בהזמנה SO26024422 שמופיעה בקישור המעקב?"
const BAD_REPLY =
  "*הום בוט :)*\nבדקתי, ההזמנה נמצאה, אך לא ניתן להציג כרגע סטטוס משלוח חד-משמעי. הפנייה תועבר להמשך טיפול."

/** Replay 533856219 — delivery date opener + כן בבקשה must not handoff without ETA answer. */
describe("ETA delivery date confirm 533856219", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "כן" },
    { role: "user", content: ETA_OPENER },
    { role: "assistant", content: BOT_CONFIRM },
  ]
  const body = "כן בבקשה"

  it("detects delivery-date thread via hints even when shipping detector misses opener", () => {
    assert.equal(isShippingThreadFromHistory(history), false)
    assert.equal(isKnownOrderConfirmPending(history), true)
    assert.equal(orderIdGivenInThread(history), "SO26024422")
  })

  it("prompt teaches ETA answer after כן בבקשה — no handoff on ambiguous status", () => {
    const line = prompt
      .split("\n")
      .find((l) => l.includes("533856219") && l.includes("תאריך אספקה"))
    assert.ok(line, "missing ETA delivery-date confirm rule for 533856219")
    assert.match(line!, /action: reply/)
    assert.match(line!, /human_service/)
  })

  it("hints lookup + ETA policy — never human_service on confirm turn", () => {
    const hints = buildConversationHints({ body, history }) ?? ""
    assert.match(hints, /KNOWN ORDER CONFIRM \+ ETA \(533011641.*533856219/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /כן בבקשה/)
    assert.match(hints, /533856219/)
    assert.match(hints, /Never human_service unless they ask for a rep/)
    assert.match(hints, /never "לא ניתן להציג סטטוס"/)
  })

  it("bad reply handoff without answering delivery date", () => {
    assert.match(BAD_REPLY, /הפנייה תועבר/)
    assert.doesNotMatch(BAD_REPLY, /מועד|תאריך|שליח|מתי/)
  })
})
