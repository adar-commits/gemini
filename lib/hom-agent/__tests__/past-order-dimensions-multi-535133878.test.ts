import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { isPastOrderSizeRecallQuestion } from "@/lib/agents/sales-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const OPENING =
  "יש לי שלושה שטיחים שנרכשו אצלכם בעבר ואני צריכה לדעת את המידות המדויקות שלהם. תוכל לבדוק במערכת?"

const BAD_EXCHANGE_PIVOT =
  "*הום בוט :)*\nמעולה! נמשיך עם החלפה 😊 קודם נאתר את ההזמנה — אפשר לשלוח מספר הזמנה (למשל SO26005938 או #76884), או לאשר שהיא על המספר שממנו אנחנו מתכתבים."

/** 535133878 — multi-order purchased-rug dimensions must not pivot to exchange intake. */
describe("past order dimensions multi 535133878", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: OPENING },
    {
      role: "assistant",
      content:
        "*הום בוט :)* קודם אמצא את ההזמנה שלכם בזריזות, האם היא רשומה על המספר ממנו אני מתכתב כרגע? (054-4618513) אם לא, אשמח לקבל אותו.",
    },
    { role: "user", content: "כן" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* מצאתי הזמנה שבוצעה לפני 1398 ימים באתר אינטרנט, על סך 886.55 ש״ח. זו ההזמנה? (מס׳ הזמנה ⁦#21189⁩)",
    },
    { role: "user", content: "כן אבל יש עוד" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* מעולה, אז ⁦#21189⁩ היא אחת ההזמנות השטיחים האחרים נרכשו בהזמנות נפרדות? אם יש לך מספרי הזמנה שלהן, או שהן נרכשו בסניף או על מספר טלפון אחר, אשמח שתכתבי לי כאן וכך נאתר את כולן.",
    },
    {
      role: "user",
      content:
        "נרכשו בנפרד אני לא זוכרת באיזה סניף. ההזמנה הישנה כללה שני שטיחים וזו שמצאת כללה שטיח אחד",
    },
  ]

  const body =
    "מספר שממנו אנחנו מתכתבים אין לי מספר הזמנה"

  it("detects purchased-rug dimensions ask from opening wording", () => {
    assert.equal(isPastOrderSizeRecallQuestion(OPENING), true)
  })

  it("prompt binds multi-order dimension lookup — never exchange opener", () => {
    const line = prompt.split("\n").find((l) => l.includes("535133878"))
    assert.ok(line)
    assert.match(line!, /נמשיך עם החלפה|exchange/i)
    assert.match(line!, /lookup_order_status/)
  })

  it("hints during active order lookup forbid exchange pivot", () => {
    const hints =
      buildConversationHints({
        history,
        body,
        whatsappPhone: "+972544618513",
      }) ?? ""
    assert.match(hints, /535133878/)
    assert.match(hints, /Never.*החלפה|Never.*«נמשיך עם החלפה»/i)
    assert.doesNotMatch(hints, /RETURN OPTIONS FIRST/i)
  })

  it("documents wrong exchange pivot from production", () => {
    assert.match(BAD_EXCHANGE_PIVOT, /נמשיך עם החלפה/)
  })
})
