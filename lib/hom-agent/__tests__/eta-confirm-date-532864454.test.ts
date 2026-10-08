import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import {
  isOrderConfirmationPending,
  isOrderConfirmationYes,
  isOrderDeliveryStatusQuestion,
  pendingOrderNumberFromHistory,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const OPENER = "מתי אקבל את השטיח?"
const BOT_WAIT = "*הום בוט :)* אני על זה, כמה רגעים בבקשה 🙏"
const BOT_CARD =
  "*הום בוט :)* מצאתי הזמנה שבוצעה לפני 18 ימים בראשון לציון, על סך 645 ש״ח. זו ההזמנה? (מס׳ הזמנה ⁦SO26022977⁩)"
const CONFIRM = "כן מ 20.09.26"
const BAD_REPLY =
  "*הום בוט :)* תודה על האישור, לודה כרגע לא מוצג לי כאן סטטוס המשלוח של הזמנה SO26022977 מ־20.09.26, ולכן אני מעביר עכשיו לנציג שירות שיבדוק איפה ההזמנה עומדת ומתי צפוי להגיע השטיח."

/** Replay 532864454 — ETA opener + confirm with order date must lookup, not handoff. */
describe("ETA confirm with date 532864454", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: OPENER },
    { role: "assistant", content: BOT_WAIT },
    { role: "assistant", content: BOT_CARD },
  ]

  it("detects ETA opener and order card confirm pending", () => {
    assert.equal(isOrderDeliveryStatusQuestion(OPENER), true)
    assert.equal(isOrderConfirmationPending(history), true)
    assert.equal(pendingOrderNumberFromHistory(history), "SO26022977")
    assert.equal(isOrderConfirmationYes(CONFIRM), false)
    assert.match(buildConversationHints({ body: CONFIRM, history }) ?? "", /532864454/)
  })

  it("prompt teaches lookup after confirm with date — no pre-lookup handoff", () => {
    const line = prompt
      .split("\n")
      .find((l) => l.includes("532864454") && l.includes("ETA opener"))
    assert.ok(line, "missing ETA opener confirm rule for 532864454")
    assert.match(line!, /lookup_order_status/)
    assert.match(line!, /כן מ 20\.09\.26/)
  })

  it("hints bind confirm + date to lookup_order_status — not human_service", () => {
    const hints = buildConversationHints({ body: CONFIRM, history }) ?? ""
    assert.match(hints, /SHIPPING ORDER CONFIRM YES \(.*532864454/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /never.*לא ניתן להציג.*human_service on this turn/i)
  })

  it("bad reply handed off without lookup", () => {
    assert.match(BAD_REPLY, /לא מוצג/)
    assert.match(BAD_REPLY, /מעביר/)
  })
})
