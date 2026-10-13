import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import {
  isPreDeliveryCancelHandoffResponseWaitFollowUp,
  isPreDeliveryCancelServiceHandoffAwaitingCallback,
} from "@/lib/agents/post-handoff"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const OPENING =
  "מודיעה על ביטול עסקה במיידי, מצפה להחזר כספי מלא הזמנתי באתר ב 29/9 לא קיבלתי מוצרים קבלה RC269021993 חשבונית מס IN264022126 הזמנה #77937"

const BAD_FIRST_REPLY =
  "*הום בוט :)* יעל, מבין שחיכית ורצית לבטל. בדקתי את הזמנה #77937 (3 פריטים, 236.5 ש״ח). היא עדיין לא נשלחה אלייך, כרגע היא בהעברה מהסניף למחסן שלנו. כדי לבטל, צריך לפתוח בקשת ביטול בפורטל: https://returns.carpetshop.co.il/?phone=0544562719"

/** 533685634 — undelivered cancel; returns portal is post-receipt only. */
describe("pre-delivery cancel no returns portal 533685634", () => {
  it("opening cancel + not received gets no-portal pre-delivery hint", () => {
    const hints = buildConversationHints({
      history: [],
      body: OPENING,
      whatsappPhone: "0544562719",
    })
    assert.notEqual(hints, null)
    assert.match(hints!, /533685634/)
    assert.match(hints!, /never send it/i)
    assert.match(hints!, /action human_service/)
    assert.doesNotMatch(hints!, /portal link \+ transfer to stop delivery/i)
  })

  it("prompt teaches undelivered cancel without returns portal", () => {
    const block = prompt.slice(
      prompt.indexOf("Pre-delivery cancel — cancel routing"),
      prompt.indexOf("- **Portal phone prefill")
    )
    assert.match(block, /533685634/)
    assert.match(block, /post-receipt returns only/i)
    assert.match(block, /action: human_service/)
  })

  it("records the wrong first reply pattern (portal on undelivered cancel)", () => {
    assert.match(BAD_FIRST_REPLY, /returns\.carpetshop/)
    assert.match(BAD_FIRST_REPLY, /עדיין לא נשלחה/)
  })
})

const SECOND_HANDOFF =
  "*הום בוט :)* יעל, תודה שעדכנת. מצטער על הבלבול בפורטל. אני מעביר את הבקשה לנציג שירות עכשיו. מעולה, העברתי את השיחה לנציג שירות. ניצור קשר בהקדם."

function historyBeforeCreditChase(): HistoryMessage[] {
  return [
    { role: "user", content: OPENING },
    { role: "assistant", content: BAD_FIRST_REPLY },
    { role: "user", content: "בפורטל מופיע סכום נמוך" },
    { role: "assistant", content: SECOND_HANDOFF },
    { role: "user", content: "תוך כמה זמן כי אתם לא חוזרים" },
  ]
}

/** Replay 533685634 — ביטול עסקה + מרדף זיכוי/אי-חזרה אחרי העברה. */
describe("pre-delivery cancel handoff wait 533685634", () => {
  it("detects ביטול עסקה thread after service handoff", () => {
    assert.equal(isPreDeliveryCancelServiceHandoffAwaitingCallback(historyBeforeCreditChase()), true)
  })

  it("detects credit/no-callback chase wording", () => {
    const body =
      "אפשר להבין מה זה השירות לקוחות המזעזע שלכם למה אתם לא חוזרים אליי למה לא מעבירים זיכוי"
    assert.equal(isPreDeliveryCancelHandoffResponseWaitFollowUp(historyBeforeCreditChase(), body), true)
  })

  it("hints reply on credit chase — not duplicate human_service", () => {
    const hints =
      buildConversationHints({
        history: historyBeforeCreditChase(),
        body: "למה לא מעבירים זיכוי",
        whatsappPhone: "0544562719",
      }) ?? ""
    assert.match(hints, /533685634/)
    assert.match(hints, /action: reply/i)
    assert.match(hints, /never.*human_service/i)
  })
})
