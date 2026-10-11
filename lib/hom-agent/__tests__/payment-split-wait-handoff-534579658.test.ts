import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { isCheckoutPaymentSplitCancelThread } from "@/lib/agents/payment-intent"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

function history534579658(): HistoryMessage[] {
  return [
    { role: "user", content: "אני מחייגת אין מענה" },
    {
      role: "user",
      content:
        "היי, ב 09/10 קיבלנו בקשה לעסקת אינטרנט בכרטיס מסטרקארד המסתיים ב 8012",
    },
    { role: "user", content: "חייבתם אותי" },
    {
      role: "user",
      content:
        "רציתי לשלם ב-BUYME רק את ה-34 שקל שזה ההפרש באשראi חייבת מאת הכל באשראi אני צריכה שתעשו ביטול עסקה ועסקה מחדש",
    },
  ]
}

/** Replay 534579658 — wait ping after BUYME/credit split; handoff must not say ביטול ההזמנה. */
describe("payment split wait handoff 534579658", () => {
  it("detects checkout payment split cancel thread from history", () => {
    assert.equal(isCheckoutPaymentSplitCancelThread(history534579658(), "???"), true)
  })

  it("prompt binds handoff recap to charge void not order cancel", () => {
    const line = prompt
      .split("\n")
      .find((l) => l.includes("Checkout payment split failure + cancel (534268241 / 534579658)"))
    assert.ok(line)
    assert.match(line!, /ביטול עסקה/)
    assert.match(line!, /never.*ביטול ההזמנה/i)
  })

  it("wait ping hints human_service with payment-split recap wording", () => {
    const hints =
      buildConversationHints({
        history: history534579658(),
        body: "???",
      }) ?? ""
    assert.match(hints, /534579658/)
    assert.match(hints, /CHECKOUT PAYMENT SPLIT CANCEL/)
    assert.match(hints, /human_service/)
    assert.match(hints, /never.*ביטול ההזמנה/i)
    assert.doesNotMatch(hints, /PRE-DELIVERY CANCEL OPENING/)
  })
})
