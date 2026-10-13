import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import {
  isExtraRugPickupHandoffWaitFollowUp,
  isOpenExtraRugPickupServiceHandoffThread,
} from "@/lib/agents/post-handoff"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const FIRST_HANDOFF =
  "*הום בוט :)* מצטער שחיכית כל כך הרבה זמן ועל ההודעות המבלבלות קודם. מעולה, העברתי את השיחה לנציג שירות. ניצור קשר בהקדם."

const FAQ_THANKS =
  "*הום בוט :)* Di, בשמחה! 😊 הנציג כבר קיבל את הפנייה ויצור קשר בהקדם."

function historyBeforeThanks(): HistoryMessage[] {
  return [
    { role: "user", content: "אפשר עזרה?" },
    { role: "assistant", content: FIRST_HANDOFF },
    { role: "user", content: "עדיין מחכה" },
    {
      role: "user",
      content:
        "שלחתם שטיח נוסף בטעות. מוזמנים לבוא לאסוף אותו. בנוסף צריכה המלצה על שטיח אחר לטובת החלפה",
    },
  ]
}

function historyBeforeSaleFollowUp(): HistoryMessage[] {
  return [
    ...historyBeforeThanks(),
    { role: "user", content: "תודה" },
    { role: "assistant", content: FAQ_THANKS },
  ]
}

/** Replay 533672658 — post-handoff thanks and sale-intent follow-up must not re-handoff. */
describe("extra rug handoff wait 533672658", () => {
  it("detects open extra-rug service handoff thread", () => {
    assert.equal(isOpenExtraRugPickupServiceHandoffThread(historyBeforeThanks()), true)
  })

  it("detects sale-intent follow-up after service handoff", () => {
    const body = "השטיח ימכר\nתודה"
    assert.equal(
      isExtraRugPickupHandoffWaitFollowUp(historyBeforeSaleFollowUp(), body),
      true
    )
  })

  it("hints post-handoff thanks close — not FAQ pivot", () => {
    const hints =
      buildConversationHints({
        history: historyBeforeThanks(),
        body: "תודה",
      }) ?? ""
    assert.match(hints, /POST-HANDOFF THANKS CLOSE/)
    assert.doesNotMatch(hints, /DUPLICATE \/ EXTRA ITEM \(533672658\).*human_service/s)
  })

  it("hints reply on sale follow-up — not duplicate human_service", () => {
    const hints =
      buildConversationHints({
        history: historyBeforeSaleFollowUp(),
        body: "השטיח ימכר\nתודה",
      }) ?? ""
    assert.match(hints, /EXTRA RUG PICKUP HANDOFF WAIT \(533672658\)/)
    assert.match(hints, /action: reply/i)
    assert.match(hints, /never.*human_service/i)
  })

  it("prompt teaches extra rug pickup handoff wait", () => {
    assert.match(prompt, /533672658/)
    assert.match(prompt, /Extra rug pickup handoff wait/i)
  })
})
