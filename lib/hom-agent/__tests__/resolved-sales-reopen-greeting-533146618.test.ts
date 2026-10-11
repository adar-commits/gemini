import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const BAD_HANDOFF =
  "*הום בוט :)* שלום Luna! סליחה, פספסתי קודם את השאלה שלך על ההנחה 🙏 מעולה, העברתי את השיחה ליועץ מכירות."

/** Replay 533146618 — bare שלום after «קניתי אחד אחר» must not belated discount + human_sales. */
describe("resolved sales reopen greeting 533146618", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "תודה רבה, אם אני מזמינה עכשיו אני מקבלת את ההנחה?" },
    { role: "assistant", content: "*הום בוט :)* Luna, שמחתי לעזור היום! 😊" },
    { role: "user", content: "לא, קניתי אחד אחר בסוף- תודה רבה!" },
    { role: "assistant", content: "*הום בוט :)* הפנייה נסגרה עקב חוסר פעילות 🙏" },
  ]

  it("hints fresh greeting — no belated human_sales", () => {
    const hints = buildConversationHints({ body: "שלום", history }) ?? ""
    assert.match(hints, /RESOLVED SALES REOPEN GREETING \(533146618\)/)
    assert.match(hints, /action: reply/)
    assert.match(hints, /never.*human_sales/i)
  })

  it("prompt teaches resolved sales bare hello", () => {
    const line = prompt.split("\n").find((l) => l.includes("533146618"))
    assert.ok(line, "missing 533146618 resolved sales reopen rule")
    assert.match(line!, /קניתי אחד אחר|בלי.*כאן/)
    assert.match(line!, /human_sales/)
  })

  it("bad reply belatedly transferred to sales", () => {
    assert.match(BAD_HANDOFF, /העברתי.*מכירות/)
    assert.match(BAD_HANDOFF, /הנחה/)
  })
})
