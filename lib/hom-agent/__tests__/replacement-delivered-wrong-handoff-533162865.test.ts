import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { isReplacementDeliveredStillWrongThread } from "@/lib/agents/post-handoff"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const OPENING =
  "שלום מבקשת לחזור אלי עוד היום עם תאום האספקה… במידה ולא תבוצע החלפה לשטיח תקין עד מחר, אני מבקשת ביטול עיסקה והחזר מלא לאשראי."

const FIRST_HANDOFF =
  "*הום בוט :)* שלום דיאנה… אני מעביר עכשיו את הפנייה לנציג שירות ומסימן אותה כדחופה"

const EXECUTED_HANDOFF =
  "*הום בוט :)* תודה, דיאנה. העברתי את הפנייה לנציג שירות וסימנתי אותה כדחופה"

const DELIVERY_WRONG =
  "שלום הבוקר הגיע שליח עם השטיח ללא שום התרעה מוקדמת ולצערי השטיח החלופי עם אותה הסיומת שלא כמו שמופיע באתר… אני מבקשת ביטול עיסקה והחזר מלא לאשראי."

const CANT_DETAIL =
  "זה מבחינתי חלק מביקורת איכות קאנט זה חלק מאוד משמעותי באיכות השטיח… הספק לפעמים מביא גם כזה. אני אבקש שישלחו את השני"

function history533162865DeliveredWrong(): HistoryMessage[] {
  return [
    { role: "user", content: OPENING },
    { role: "assistant", content: FIRST_HANDOFF },
    { role: "user", content: "כן" },
    { role: "assistant", content: EXECUTED_HANDOFF },
    { role: "user", content: "טרם חזרו אלי" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* מצטער שעדיין לא חזרו אלייך… סימנתי שוב את הפנייה כדחופה",
    },
    { role: "user", content: DELIVERY_WRONG },
    { role: "user", content: CANT_DETAIL },
  ]
}

/** Replay 533162865 — after delivery reported, handoff recap must not say replacement has not arrived. */
describe("replacement delivered wrong handoff recap (533162865)", () => {
  it("detects replacement delivered but still wrong thread", () => {
    assert.equal(
      isReplacementDeliveredStillWrongThread(history533162865DeliveredWrong()),
      true
    )
  })

  it("prompt binds delivered-but-wrong recap", () => {
    const line = prompt
      .split("\n")
      .find((l) => l.includes("Replacement delivered but still wrong (533162865)"))
    assert.ok(line)
    assert.match(line!, /עדיין לא הגיע/)
  })

  it("hints forbid stale «עדיין לא הגיע» bullets", () => {
    const hints =
      buildConversationHints({
        history: history533162865DeliveredWrong(),
        body: CANT_DETAIL,
      }) ?? ""
    assert.match(hints, /REPLACEMENT DELIVERED STILL WRONG \(533162865\)/)
    assert.match(hints, /עדיין לא הגיע/)
    assert.match(hints, /human_service/i)
  })
})
