import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const STATUS_OFFER =
  "*הום בוט :)* מעולה כלילה, ההזמנה #78498 התקבלה אצלנו במערכת היא בוצעה לפני יומיים באתר. כרגע לא הצלחתי להציג כאן את סטטוס המשלוח המעודכן. חברת השליחויות יוצרת קשר ביום האספקה עצמו, לקראת ההגעה. תרצי שאעביר לנציג שירות שיבדוק לך את סטטוס המשלוח?"

const HANDOFF =
  "*הום בוט :)* מעולה, העברתי את השיחה לנציג שירות. ניצור קשר בהקדם."

function history274323208(): HistoryMessage[] {
  return [
    { role: "user", content: "התקבלה ההזמנה שלי ?" },
    { role: "user", content: "0586004025" },
    { role: "assistant", content: "*הום בוט :)* מצאתי הזמנה… זו ההזמנה? (מס׳ הזמנה #78498)" },
    { role: "user", content: "כן תודה" },
    { role: "assistant", content: STATUS_OFFER },
    { role: "user", content: "כן" },
    { role: "assistant", content: HANDOFF },
  ]
}

/** Replay 274323208 — wait ping after rep shipping-status handoff must not duplicate human_service. */
describe("shipping status wait ping 274323208", () => {
  it("?? wait ping hints reply — not duplicate handoff", () => {
    const hints =
      buildConversationHints({
        history: history274323208(),
        body: "??",
      }) ?? ""
    assert.match(hints, /SERVICE SHIPPING STATUS WAIT PING \(274323208\)/)
    assert.match(hints, /78498/)
    assert.match(hints, /action: reply/i)
    assert.match(hints, /NEVER duplicate.*human_service/i)
  })

  it("יש תשובה chase gets the same wait hint", () => {
    const hints =
      buildConversationHints({
        history: history274323208(),
        body: "יש תשובה",
      }) ?? ""
    assert.match(hints, /274323208/)
    assert.match(hints, /NEVER duplicate/i)
  })

  it("prompt teaches rep shipping status wait ping", () => {
    const line = prompt.split("\n").find((l) => l.includes("274323208"))
    assert.ok(line)
    assert.match(line!, /action: reply/)
    assert.match(line!, /Never.*duplicate.*human_service/i)
  })
})
