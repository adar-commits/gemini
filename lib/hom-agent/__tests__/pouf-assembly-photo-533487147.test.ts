import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isPoufAssemblyFaqThread } from "@/lib/agents/kb"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const ASSEMBLY_OPENING =
  "בשמחה, נעשה את זה יחד. באיזה שלב נתקעת? למשל פתיחת המארז, הכנסת המילוי לכיסוי או סגירת הרוכסן."

function historyThroughPlasticWrapQuestion(): HistoryMessage[] {
  return [
    { role: "user", content: "אני צריכה עזרה בהרכבה של פוף" },
    { role: "assistant", content: ASSEMBLY_OPENING },
    { role: "user", content: "שאלה לגבי המילוי" },
    {
      role: "assistant",
      content:
        "בטח, מה רצית לדעת על המילוי? בינתיים, כמה דברים שכדאי לדעת: המילוי הוא תערובת של פתיתי ספוג עם מינימום קלקר.",
    },
  ]
}

const BAD_REPLY =
  "תודה, קיבלתי. תמונה אחת ברורה מספיקה — אעביר ליועץ העיצוב. לאיזה חלל מיועד המוצר? סלון, חדר שינה, או כל חלל אחר"

/** Replay 533487147 — assembly FAQ photo must not pivot to sales room question. */
describe("pouf assembly photo (533487147)", () => {
  it("detects active pouf assembly FAQ from assistant assembly steps", () => {
    assert.equal(isPoufAssemblyFaqThread(historyThroughPlasticWrapQuestion()), true)
  })

  it("emits assembly FAQ binding hint on plastic-wrap photo question", () => {
    const history = historyThroughPlasticWrapQuestion()
    const body =
      "עטיפת הניילון הזו צריך לחתוך? או להשאיר? [media:image:https://example.com/pouf.jpg]"
    const hints = buildConversationHints({ history, body }) ?? ""
    assert.match(hints, /533487147/)
    assert.match(hints, /POUF ASSEMBLY/)
    assert.doesNotMatch(hints, /יועץ העיצוב/)
    assert.doesNotMatch(hints, /human_sales/)
  })

  it("the bad reply pivoted to sales room intake", () => {
    assert.match(BAD_REPLY, /לאיזה חלל/)
    assert.match(BAD_REPLY, /יועץ העיצוב/)
  })
})
