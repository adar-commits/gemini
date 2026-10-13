import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import { classifySalesIntakeReply } from "@/lib/agents/sales-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const BAD_PETS_REPLY =
  "*הום בוט :)* אוקיי, קיבלתי. האם אמור להתאים לבעלי חיים?"

function historyThroughSofaAsk(): HistoryMessage[] {
  return [
    { role: "user", content: "היי אשמח לעזרהה בבחירת שטיח לשני חללים" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* היי! 😊 בשמחה, נעזור לבחור שטיחים לשני החללים. לאילו חללים מדובר? למשל סלון, חדר שינה, חדר ילדים או מקום אחר.",
    },
    { role: "user", content: "סלון וחדר שינה" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* מעולה, סלון וחדר שינה כדי שיועץ המכירות יקבל תמונה טובה: מה בערך אורך הספה בסלון, ומה מידת המיטה בחדר השינה (או מידות החדר, אם יותר נוח)?",
    },
  ]
}

/** Replay 534861848 — human rep ask mid sales intake must not continue pets quiz. */
describe("sales intake human rep ask 534861848", () => {
  const repAsk = "יש גם נציג אנושי?"

  it("treats explicit human rep ask as intake pivot, not quiz answer", () => {
    const history = historyThroughSofaAsk()
    assert.equal(classifySalesIntakeReply(repAsk, history), "pivot")
  })

  it("emits human_sales binding hint for 534861848", () => {
    const history = historyThroughSofaAsk()
    const hints = buildConversationHints({ history, body: repAsk }) ?? ""
    assert.match(hints, /534861848/)
    assert.match(hints, /human_sales/)
    assert.match(hints, /בעלי חיים/i)
  })

  it("prompt binds human rep ask during sales intake", () => {
    assert.match(prompt, /534861848/)
    assert.match(prompt, /נציג אנושי/)
  })

  it("the bad turn ignored rep ask and asked about pets", () => {
    assert.match(BAD_PETS_REPLY, /בעלי חיים/)
    assert.doesNotMatch(BAD_PETS_REPLY, /נציג|יועץ/i)
  })
})
