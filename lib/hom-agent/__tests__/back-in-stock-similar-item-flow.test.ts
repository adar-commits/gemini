import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import {
  isBackInStockOfferThread,
  isBackInStockSalesHandoffThread,
} from "@/lib/agents/inventory-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const OPENING = "היי, אשמח לקבל עדכון כשהמידה M - 140*200 של שטיח בל קרם BELL חוזרת למלאי"

const BOT_OFFER =
  "*הום בוט :)*\nהיי! 😊 קיבלנו את הבקשה שלך לעדכון על שטיח בל קרם במידה 140*200.\n\nאולי אוכל לעניין אותך בשטיח דומה שזמין עכשיו?"

const BOT_REFERENCE =
  "*הום בוט :)*\nבשמחה! רק לוודא — שטיח בל קרם 140*200 הוא הרפרנס הנכון למידה ולצורה?"

const BOT_HANDOFF =
  "*הום בוט :)*\nמעולה! מעביר אותך ליועץ מכירות שיציע לך שטיחים דומים במידה 140*200 — הוא בדרך 🙂"

function offerHistory(): HistoryMessage[] {
  return [
    { role: "user", content: OPENING },
    { role: "assistant", content: BOT_OFFER },
  ]
}

/** Operator policy 2026-10-09 — restock ask: offer similar → verify size+shape → human_sales. */
describe("back-in-stock similar-item flow", () => {
  it("prompt teaches the three-step flow with human_sales on confirm", () => {
    const line = prompt.split("\n").find((l) => l.includes("Back-in-stock notification"))
    assert.ok(line)
    assert.match(line!, /Similar-item flow/)
    assert.match(line!, /size and shape/)
    assert.match(line!, /הרפרנס הנכון למידה ולצורה/)
    assert.match(line!, /human_sales/)
  })

  it("thread is in the offer flow after the bot offered similar", () => {
    assert.equal(isBackInStockOfferThread(offerHistory()), true)
    assert.equal(isBackInStockSalesHandoffThread(offerHistory()), false)
  })

  it("opening turn alone is not yet the offer flow", () => {
    assert.equal(isBackInStockOfferThread([{ role: "user", content: OPENING }]), false)
  })

  it("customer yes → hint asks for size/shape reference before handoff", () => {
    const hints = buildConversationHints({ body: "כן בשמחה", history: offerHistory() })
    assert.match(hints ?? "", /BACK-IN-STOCK SIMILAR-ITEM FLOW/)
    assert.match(hints ?? "", /verify size and shape/)
    assert.match(hints ?? "", /action human_sales/)
  })

  it("reference confirm turn still gets the flow hint", () => {
    const history = [...offerHistory(), { role: "user" as const, content: "כן" }, { role: "assistant" as const, content: BOT_REFERENCE }]
    const hints = buildConversationHints({ body: "כן נכון", history })
    assert.match(hints ?? "", /BACK-IN-STOCK SIMILAR-ITEM FLOW/)
  })

  it("after the sales handoff the offer flow is over", () => {
    const history = [
      ...offerHistory(),
      { role: "user" as const, content: "כן" },
      { role: "assistant" as const, content: BOT_REFERENCE },
      { role: "user" as const, content: "כן" },
      { role: "assistant" as const, content: BOT_HANDOFF },
    ]
    assert.equal(isBackInStockSalesHandoffThread(history), true)
    assert.equal(isBackInStockOfferThread(history), false)
    const hints = buildConversationHints({ body: "תודה", history })
    assert.doesNotMatch(hints ?? "", /SIMILAR-ITEM FLOW/)
  })
})

/** Operator policy 2026-10-09 — closing principle; Sales always reaches a human. */
describe("closing principle and bare rep request (328895796)", () => {
  const section = prompt.slice(
    prompt.indexOf("### Your goal — resolve and close"),
    prompt.indexOf("### What makes a bot sound robotic")
  )

  it("prompt has the closing goal section", () => {
    assert.ok(section.length > 0)
    assert.match(section, /close the inquiry/)
  })

  it("sales is excluded from closing — human acts on 100% of sales", () => {
    assert.match(section, /Sales is excluded — a human acts on 100% of sales/)
    assert.match(section, /human_sales/)
  })

  it("bare rep request asks first, transfers on repeat", () => {
    assert.match(section, /Bare rep request \(328895796\)/)
    assert.match(section, /ask in \*\*one\*\* short line/)
    assert.match(section, /Transfer immediately/)
    assert.match(section, /\*\*repeat\*\*/)
  })
})
