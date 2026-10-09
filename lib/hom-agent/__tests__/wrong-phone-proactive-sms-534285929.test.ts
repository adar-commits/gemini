import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const PROACTIVE_SMS =
  "שלום ויויאן ממן, 👋 תודה על רכישתך בשטיח האדום, להלן קישור לקבלה הדיגיטלית שלך: https://documents.carpetshop.co.il/documents/6ed84d0c-9e34-41d2-81f9-9f31c9b30aad למעקב אחר התקדמות ההזמנה, יש ללחוץ כאן: https://tracking.carpetshop.co.il/track?orderID=SO26025002 נשמח לעמוד לרשותך בכל שאלה בערוצי הדיגיטל שלנו, תתחדשו ❤️"

function historyAfterWrongNumberReport(): HistoryMessage[] {
  return [
    { role: "assistant", content: PROACTIVE_SMS },
    { role: "user", content: "טעות\nבמספר" },
  ]
}

/** Replay 534285929 — wrong-number reply to proactive receipt SMS must not hand off. */
describe("wrong phone proactive sms (534285929)", () => {
  it("binds human_service when writing העברתי to fix wrong phone on order", () => {
    const openingRule = prompt
      .split("\n")
      .find((line) => line.includes("534285929") && line.includes("Wrong phone"))
    const routingRule = prompt
      .split("\n")
      .find((line) => line.includes("534285929") && line.includes("mistaken proactive SMS"))

    assert.ok(openingRule, "missing opening greeting rule for 534285929")
    assert.ok(routingRule, "missing routing table rule for 534285929")
    assert.match(openingRule!, /human_service/i)
    assert.match(openingRule!, /never.*reply.*העברתי/i)
    assert.match(routingRule!, /human_service/i)
    assert.match(routingRule!, /never.*reply.*העברתי/i)
  })

  it("hints reply-only on first non-business reply after proactive sms", () => {
    const hints =
      buildConversationHints({
        body: "טעות במספר",
        history: historyAfterWrongNumberReport(),
        whatsappPhone: "0501238707",
        customerName: "הילה",
      }) ?? ""

    assert.match(hints, /534285929/)
    assert.match(hints, /WRONG PHONE/i)
    assert.match(hints, /action: human_service/i)
    assert.match(hints, /never.*action: reply.*העברתי/i)
  })

  it("does not emit wrong-phone hint when customer asks about delivery", () => {
    const hints =
      buildConversationHints({
        body: "מתי ההזמנה תגיע?",
        history: [
          { role: "assistant", content: PROACTIVE_SMS },
          { role: "user", content: "מתי ההזמנה תגיע?" },
        ],
        whatsappPhone: "0501238707",
      }) ?? ""

    assert.doesNotMatch(hints, /WRONG PHONE/i)
  })
})
