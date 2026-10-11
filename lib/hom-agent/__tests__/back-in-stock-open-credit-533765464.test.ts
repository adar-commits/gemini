import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import {
  isBackInStockOfferThread,
  isBackInStockWaitForAlertOnlyReply,
  threadHasOpenCancelOrCreditChase,
} from "@/lib/agents/inventory-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const STOCK_OPENING =
  "היי, אשמח לקבל עדכון כשהמידה XL - 200*290 של שטיח נירוונה 12 גרז' NIRVANA חוזרת למלאי"

const BOT_STOCK_OFFER =
  "*הום בוט :)*\nהיי! 😊 קיבלנו את הבקשה שלך לעדכון כשהשטיח נירוונה 12 גרז' במידה XL 200*290 יחזור למלאי. בינתיים, אולי אוכל לעניין אותך בשטיח דומה?"

function historyBeforeWait(): HistoryMessage[] {
  return [
    {
      role: "user",
      content:
        "היי ביטלתי קניה של שטיח יום אחרי שרכשתי. אמרו לי שיחזרו אלי ועדיין לא נעשה כלום",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* היי, מצטער שחזרו אליכם עד עכשיו — זה לא תקין. אני מעביר עכשיו לנציג שירות לקוחות את ביטול הקנייה בהזמנה SO26024283.",
    },
    { role: "user", content: STOCK_OPENING },
    { role: "assistant", content: BOT_STOCK_OFFER },
  ]
}

/** Replay 533765464 — אמתין after restock offer must not end when open credit chase in thread. */
describe("back-in-stock open credit 533765464", () => {
  it("prompt forbids goodbye-only end when open credit exists", () => {
    const line = prompt.split("\n").find((l) => l.includes("Back-in-stock notification"))
    assert.ok(line)
    assert.match(line!, /533765464/)
    assert.match(line!, /never.*goodbye-only/i)
  })

  it("detects wait-for-alert reply in offer thread", () => {
    const history = historyBeforeWait()
    assert.equal(isBackInStockOfferThread(history), true)
    assert.equal(isBackInStockWaitForAlertOnlyReply("אמתין", history), true)
  })

  it("detects open cancel/credit chase from earlier user messages", () => {
    assert.equal(threadHasOpenCancelOrCreditChase(historyBeforeWait()), true)
  })

  it("hints never action end when both apply", () => {
    const hints = buildConversationHints({ body: "אמתין", history: historyBeforeWait() })
    assert.match(hints ?? "", /533765464/)
    assert.match(hints ?? "", /Never.*action: end/i)
  })
})
