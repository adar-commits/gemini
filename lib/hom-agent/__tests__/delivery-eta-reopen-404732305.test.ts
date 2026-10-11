import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { isShippingStatusQuestion } from "@/lib/agents/shipping"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const TRACKING_REPLY =
  "*הום בוט :)* היי לירון, את הסטטוס החי של הזמנה SO26020942 אפשר לראות בקישור המעקב: https://tracking.carpetshop.co.il/track?orderID=SO26020942"

const BAD_HANDOFF =
  "*הום בוט :)* היי לירון, מצטער על הסיבוב הקודם. כדי לקבל צפi מדויק להזמנה SO26020942, אני מעביר עכשיו לנציג שירות שיבדוק את הסטטוס בפועל"

const REOPEN = "היי, מתיי יגיע המשלוח שלי?"

/** Replay 404732305 — ETA reopen after inactivity must lookup, not human_service for «סטטוס בפועל». */
describe("delivery eta reopen after inactivity 404732305", () => {
  const history: HistoryMessage[] = [
    {
      role: "assistant",
      content:
        "tracking https://tracking.carpetshop.co.il/track?orderID=SO26020942 receipt template",
    },
    { role: "user", content: "היי, מתיי יגיע המשלוח שלי?" },
    { role: "assistant", content: TRACKING_REPLY },
    { role: "assistant", content: "*הום בוט :)* Liron Blum, עדיין כאן?" },
    {
      role: "assistant",
      content: "*הום בוט :)* הפנייה נסגרה עקב חוסר פעילות 🙏",
    },
  ]

  it("classifies reopen as shipping status", () => {
    assert.equal(isShippingStatusQuestion(REOPEN), true)
  })

  it("hints lookup after inactivity reopen — not rep for accurate ETA", () => {
    const hints = buildConversationHints({ body: REOPEN, history }) ?? ""
    assert.match(hints, /SHIPPING ETA REOPEN AFTER INACTIVITY \(404732305\)/)
    assert.match(hints, /SO26020942/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /Never apologize and transfer/)
  })

  it("prompt teaches inactivity reopen shipping ETA", () => {
    const line = prompt.split("\n").find((l) => l.includes("404732305"))
    assert.ok(line, "missing 404732305 shipping reopen rule")
    assert.match(line!, /lookup_order_status/)
    assert.match(line!, /חוסר פעילות/)
  })

  it("bad reply handed off to check actual status", () => {
    assert.match(BAD_HANDOFF, /מעביר.*נציג/)
    assert.match(BAD_HANDOFF, /סטטוס בפועל/)
  })
})
