import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import {
  buildConversationHints,
  isAwaitingReplyAfterPostponementFaqAnswer,
} from "@/lib/hom-agent/conversation-hints"

const DELAY_BODY =
  "צריך להגיע אליי היום שטוח, יש אפשרות לדחות את המשלוח? יש לי בעיה לקבל אותו היום 🙏🏻"

const FAQ_POSTPONE_REPLY =
  "*הום בוט :)* בוקר טוב ליאת, אי אפשר לקבוע דחייה מראש אצלנו במערכת. חברת השליחויות מתקשרת ביום האספקה לפני שהיא מגיעה, ובשיחה הזו אפשר להגיד לשליח שהיום לא מתאים ולתאם איתו יום אחר. אפשר גם לפנות ישירות למוקד השליחויות בטלפון *3076. רוצה שאבדוק באיזה שלב נמצאת ההזמנה שלך?"

/** Replay 533585020 — postpone-delivery FAQ must not trigger belated human_sales. */
describe("delivery postpone no sales 533585020", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "היי בוקר טוב" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* בוקר טוב ליאת! 😊 במה אפשר לעזור? אם עדיין מעניין אותך שטיח סאן קרם, אפשר להמשיך מאיפה שעצרנו.",
    },
    { role: "user", content: DELAY_BODY },
    { role: "assistant", content: FAQ_POSTPONE_REPLY },
  ]

  it("detects awaiting reply after postponement FAQ", () => {
    assert.equal(isAwaitingReplyAfterPostponementFaqAnswer(history), true)
  })

  it("binds DELIVERY POSTPONE AFTER FAQ — never human_sales", () => {
    const hints = buildConversationHints({ history, body: DELAY_BODY }) ?? ""
    assert.match(hints, /DELIVERY POSTPONE AFTER FAQ \(533585020\)/)
    assert.match(hints, /action: end/)
    assert.match(hints, /human_sales/)
    assert.match(hints, /crm_department.*service/)
  })

  it("has hom-bot binding for 533585020", () => {
    const prompt = readFileSync("lib/hom-agent/prompts/hom-bot.md", "utf8")
    const line = prompt.split("\n").find((l) => l.includes("533585020"))
    assert.ok(line, "missing 533585020 postpone-after-FAQ rule")
    assert.match(line!, /human_sales/)
  })
})
