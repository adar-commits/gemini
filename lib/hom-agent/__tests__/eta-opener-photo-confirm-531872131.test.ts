import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import {
  isKnownOrderConfirmPending,
  isOrderDeliveryStatusQuestion,
  isServiceOrderIdentificationFlow,
  isShippingThreadFromHistory,
  orderIdGivenInThread,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const OPENER =
  "שלום עשיתי הזמנה לפני חודש בערך ועוד לא קיבלתי את ההזמנה מתי צפוי לקבל אותה?"
const BOT_CONFIRM =
  "*הום בוט :)*\nשלום נגם, חודש זה באמת הרבה זמן, אז נבדוק את זה עכשיו. מדובר בהזמנה SO26022029 שמופיעה בקישור המעקב ששלחנו?"
const PHOTO =
  "[תמונה][media:image:https://storage.googleapis.com/media.landbot.io/256062/customers/531624045/ACJJ5TMZH5Y53IP0MFJVZB2QM3Z876TW.jpg]"
const BAD_REPLY =
  "*הום בוט :)*\nכדי שהנציג לא יצטרך לשאול שוב, זה מה שאעביר לו:\n• מס׳ הזמנה: ⁦#76670⁩\n• פנייה לשירות לקוחות\n\nזה מדויק, או שחסר משהו?"

/** Replay 531872131 — ETA opener + tracking photo must not open service rep summary. */
describe("ETA opener photo confirm 531872131", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: OPENER },
    { role: "assistant", content: BOT_CONFIRM },
  ]

  it("detects shipping thread and known order confirm pending", () => {
    assert.equal(isOrderDeliveryStatusQuestion(OPENER), true)
    assert.equal(isShippingThreadFromHistory(history), true)
    assert.equal(isKnownOrderConfirmPending(history), true)
    assert.equal(orderIdGivenInThread(history), "SO26022029")
  })

  it("does not treat photo confirm on shipping ETA thread as service identification", () => {
    assert.equal(isServiceOrderIdentificationFlow(history, PHOTO), false)
  })

  it("prompt teaches photo confirm on ETA thread — lookup not service summary", () => {
    const line = prompt
      .split("\n")
      .find((l) => l.includes("531872131") && l.includes("photo confirm"))
    assert.ok(line, "missing ETA opener + photo confirm rule")
    assert.match(line!, /lookup_order_status/)
    assert.match(line!, /Never.*service rep summary/i)
  })

  it("hints lookup + ETA — never service summary or PHOTO RECEIVED sales handoff", () => {
    const hints = buildConversationHints({ body: PHOTO, history }) ?? ""
    assert.match(hints, /KNOWN ORDER CONFIRM PHOTO \(531872131\)/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /ETA policy/)
    assert.doesNotMatch(hints, /SERVICE ORDER ID/)
    assert.doesNotMatch(hints, /PHOTO RECEIVED \(533695023/)
  })

  it("bad reply opened service handoff summary instead of shipping status", () => {
    assert.match(BAD_REPLY, /(?:מעביר|אעביר)/)
    assert.match(BAD_REPLY, /שירות לקוחות/)
    assert.doesNotMatch(BAD_REPLY, /סטטוס|משלוח|מועד|מתי/)
  })
})
