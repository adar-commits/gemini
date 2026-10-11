import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { isOrderDeliveryStatusQuestion } from "@/lib/agents/order-lookup"
import { isShippingStatusQuestion } from "@/lib/agents/shipping"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const OPENER =
  "היי, אשמח לעדכון אם אני זוכרת נכון היה רשום באתר משלוח צפוי עד ה9.10 אז אשמח לדעת מה סטטוס ההזמנה תודה"
const BAD_REPLY =
  "*הום בוט :)* בקצרה — הסטטוס מתאר את מצב ההזמנה במערכת לפי העדכון האחרון. אם משהו לא ברור או צריך בירור — האם להעביר לנציג שירות שיסביר ויתעדכן?"

/** Replay 533793181 — website promised date + status ask must lookup, not meta FAQ + handoff. */
describe("website promised delivery status 533793181", () => {
  const history: HistoryMessage[] = []

  it("classifies opener as shipping/order status", () => {
    assert.equal(isOrderDeliveryStatusQuestion(OPENER), true)
    assert.equal(isShippingStatusQuestion(OPENER), true)
  })

  it("hints lookup_order_status — not meta status FAQ + handoff offer", () => {
    const hints = buildConversationHints({ body: OPENER, history }) ?? ""
    assert.match(hints, /WEBSITE PROMISED DELIVERY \+ STATUS \(533793181\)/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /Never open with a meta FAQ/)
  })

  it("prompt teaches website promised date + status opener", () => {
    const line = prompt.split("\n").find((l) => l.includes("533793181"))
    assert.ok(line, "missing website promised status rule for 533793181")
    assert.match(line!, /lookup_order_status/)
    assert.match(line!, /סטטוס/)
  })

  it("bad reply offered handoff without lookup", () => {
    assert.match(BAD_REPLY, /האם להעביר לנציג/)
    assert.doesNotMatch(BAD_REPLY, /בדקתי/)
  })
})
