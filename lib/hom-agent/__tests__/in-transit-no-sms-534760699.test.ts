import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { isServiceOrderIdentificationFlow } from "@/lib/agents/order-lookup"
import { isShippingStatusQuestion } from "@/lib/agents/shipping"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const ORDER_CARD_ASK =
  "*הום בוט :)* מצאתי הזמנה שבוצעה לפני יום באתר אינטרנט, על סך 354 ש״ח. זו ההזמנה? (מס׳ הזמנה #78639)"

const BAD_SUMMARY =
  "*הום בוט :)* כדי שהנציג לא יצטרך לשאול שוב, זה מה שאעביר לו:\n• מס׳ הזמנה: #78639\n• אי-שביעות רצון מהמוצר\nזה מדויק, או שחסר משהו?"

/** Replay 534760699 — in-transit + no SMS must not become product-dissatisfaction summary after order confirm. */
describe("in transit no sms 534760699", () => {
  const opener = "רשום שהזמנה שלי בדרך ולא קיבלתי הודעה"

  const historyBeforeConfirm: HistoryMessage[] = [
    { role: "user", content: "היי" },
    { role: "assistant", content: "*הום בוט :)* היי לירי! 😊 במה אפשר לעזור?" },
    { role: "user", content: opener },
    { role: "assistant", content: ORDER_CARD_ASK },
  ]

  it("classifies opener as shipping status, not service identification", () => {
    assert.equal(isShippingStatusQuestion(opener), true)
    assert.equal(isServiceOrderIdentificationFlow(historyBeforeConfirm, "כן"), false)
  })

  it("hints shipping lookup on order confirm, not service summary", () => {
    const hints = buildConversationHints({ body: "כן", history: historyBeforeConfirm }) ?? ""
    assert.match(hints, /SHIPPING ORDER CONFIRM YES/)
    assert.match(hints, /534760699/)
    assert.match(hints, /lookup_order_status/)
    assert.doesNotMatch(hints, /SERVICE ORDER ID/)
  })

  it("prompt teaches in-transit + no SMS without product dissatisfaction summary", () => {
    const line = prompt.split("\n").find((l) => l.includes("534760699"))
    assert.ok(line, "missing 534760699 in-transit rule")
    assert.match(line!, /אי-שביעות רצון/)
    assert.match(line!, /lookup_order_status/)
  })

  it("documents the wrong pivot from production", () => {
    assert.match(BAD_SUMMARY, /אי-שביעות רצון/)
  })
})
