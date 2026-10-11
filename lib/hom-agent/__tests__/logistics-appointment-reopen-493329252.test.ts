import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { extractOrderReference } from "@/lib/agents/order-lookup"
import { isShippingStatusQuestion } from "@/lib/agents/shipping"
import { isOrderDeliveryStatusQuestion } from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const DELAY_HANDOFF =
  "*הום בוט :)* סליחה, טעיתי בהודעה הקודמת: היום כבר 8/10, כך שהמועד שהובטח לך (7/10/26) עבר אתמול. במערכת עדיין אין תאריך אספקה חדש. לפי הסטטוס האחרון, ההזמנה נשלחה מהסניף ועדיין לא הגיעה למחסני החברה, ומשם היא יוצאת למשלוח. מכיוון שהמועד עבר, אני מעביר אותך עכשיו לנציג שירות. הוא יבדוק את ההזמנה SO26024428 ויעדכן אותך מתי היא צפויה להגיע."

const LOGISTICS_NOTE =
  "הי, אני רואה שתואמה אספקה בהודעה מול סלע לוגיסטים"

const ASK = "שלום, למתי תואמה אספקה?"

const BAD_REPLY =
  "*הום בוט :)* שלום! כרגע לא תואם מועד אספקה להזמנה SO26024428. לפי הסטטוס האחרון, ההזמנה יצאה מהסניף ועדיין בדרך למחסני החברה, ומשם היא יוצאת למשלוח. ביום האספקה חברת השליחויות תתקשר אלייך לפני שהם מגיעים. מצטער שעדיין לא חזרו אלייך. המועד שהובטח לך עבר, אז אני מעביר את הפנייה לנציג שירות. הוא יבדוק את ההזמנה SO26024428 ויעדכן אותך מתי היא צפויה להגיע. מעולה, העברתי את השיחה לנציג שירות. ניצור קשר בהקדם."

/** Replay 493329252 — «למתי תואמה אספקה» after Sela coordination must lookup, not deny date + re-handoff. */
describe("logistics appointment reopen 493329252", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "מתי ההזמנה אמורה להגיע?" },
    { role: "assistant", content: DELAY_HANDOFF },
    { role: "assistant", content: LOGISTICS_NOTE },
    { role: "user", content: "למתי?" },
    { role: "user", content: "למתי" },
  ]

  it("detects logistics appointment question", () => {
    assert.equal(isOrderDeliveryStatusQuestion(ASK), true)
    assert.equal(isShippingStatusQuestion(ASK), false)
    assert.equal(extractOrderReference(DELAY_HANDOFF), "SO26024428")
  })

  it("hints lookup — not duplicate human_service or «לא תואם מועד»", () => {
    const hints = buildConversationHints({ body: ASK, history }) ?? ""
    assert.match(hints, /LOGISTICS APPOINTMENT DATE \(493329252\)/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /never «כרגע לא תואם מועד»/i)
    assert.match(hints, /493329252/)
  })

  it("prompt teaches logistics appointment follow-up", () => {
    const line = prompt.split("\n").find((l) => l.includes("493329252"))
    assert.ok(line, "missing 493329252 logistics appointment rule")
    assert.match(line!, /למתי תואמה אספקה/)
    assert.match(line!, /lookup_order_status/)
  })

  it("bad reply denied coordination and re-transferred", () => {
    assert.match(BAD_REPLY, /לא תואם מועד/)
    assert.match(BAD_REPLY, /העברתי/)
    assert.doesNotMatch(BAD_REPLY, /lookup/i)
  })
})
