import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { UNKNOWN_DELIVERY_STATUS_MESSAGE } from "@/lib/agents/delivery-status-terminology"
import {
  isKnownOrderConfirmPending,
  isOrderDeliveryStatusQuestion,
  isShippingThreadFromHistory,
  orderIdGivenInThread,
  shouldBindKnownOrderTurn,
  shouldDeferUnknownDeliveryStatusHandoff,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const ETA_OPENER = "מתי המשלוח שלי יגיע?!"
const BOT_CONFIRM =
  "*הום בוט :)*\nהיי, הכוונה להזמנה SO26022776 מקישור המעקב שקיבלת? אחרי שתאשר/י אבדוק מה המצב שלה עכשיו."
const BODY = "אני מדבר עם בוט?!\nאיזה דינים!!!\nכן זאת ההזמנה"
const BAD_REPLY =
  "*הום בוט :)*\nבדקתי, ההזמנה נמצאה, אך לא ניתן להציג כרגע סטטוס משלוח חד-משמעי. הפנייה תועבר להמשך טיפול."

/** Replay 532716685 — ETA confirm after bot frustration must not auto-handoff on unknown status. */
describe("ETA frustrated confirm 532716685", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: ETA_OPENER },
    { role: "assistant", content: BOT_CONFIRM },
  ]

  it("detects shipping ETA thread and known order confirm pending", () => {
    assert.equal(isOrderDeliveryStatusQuestion(ETA_OPENER), true)
    assert.equal(isShippingThreadFromHistory(history), true)
    assert.equal(isKnownOrderConfirmPending(history), true)
    assert.equal(orderIdGivenInThread(history), "SO26022776")
  })

  it("binds frustrated multi-part confirm via shipping thread state", () => {
    assert.equal(shouldBindKnownOrderTurn(BODY, history), true)
  })

  it("defers unknown-status auto-handoff on ETA confirm thread", () => {
    assert.equal(shouldDeferUnknownDeliveryStatusHandoff(history), true)
    const statusReply = `*הום בוט :)*\nבדקתי, ${UNKNOWN_DELIVERY_STATUS_MESSAGE}`
    assert.match(statusReply, /לא ניתן להציג כרגע סטטוס משלוח/)
  })

  it("prompt teaches ETA answer after frustrated confirm — no auto handoff", () => {
    const line = prompt
      .split("\n")
      .find((l) => l.includes("532716685") && l.includes("ETA opener + bare confirm"))
    assert.ok(line, "missing ETA frustrated confirm rule for 532716685")
    assert.match(line!, /action: reply/)
    assert.match(line!, /כן זאת ההזמנה/)
  })

  it("hints lookup + ETA policy — never human_service on confirm turn", () => {
    const hints = buildConversationHints({ body: BODY, history }) ?? ""
    assert.match(hints, /532716685/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /never "לא ניתן להציג סטטוס"/)
    assert.doesNotMatch(hints, /EXPLICIT REP REQUEST/)
  })

  it("bad reply auto-handed off instead of ETA policy", () => {
    assert.match(BAD_REPLY, /לא ניתן להציג כרגע סטטוס משלוח/)
    assert.match(BAD_REPLY, /הפנייה תועבר/)
  })
})
