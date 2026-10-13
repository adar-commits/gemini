import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isDeliveryCoordinationTimingFollowUp,
  isOpenDeliveryCoordinationServiceHandoffThread,
} from "@/lib/agents/post-handoff"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const HANDOFF =
  "*הום בוט :)* מבין אותך, אורנה. מכאן אני לא יכול לתאם מול חברת ההובלה, ולכן אני מעביר אותך עכשיו לנציג שירות. הוא ייצור קשר עם חברת ההובלה בנוגע להזמנה שלך. מעולה, העברתי את השיחה לנציג שירות. ניצור קשר בהקדם."

const LIVE_REP = "הי. לא ניתן לתאם שעות."

function history313407519(): HistoryMessage[] {
  return [
    {
      role: "user",
      content: "איך אפשר לתאם את שעת מסירת השטיח שרכשתי מול חברת ההובלה?",
    },
    {
      role: "user",
      content: "אבל הם לא יצרו קשר. הנהג התקשר ואמר שהגיע.",
    },
    { role: "assistant", content: HANDOFF },
    {
      role: "user",
      content: "תודה. אפשר להגיע מחר, יום שלישי 13.10 בין 9 בבוקר ל 11",
    },
    { role: "assistant", content: LIVE_REP },
    { role: "user", content: "בקש מהם שיצרו איתי קשר ישירות בבקשה" },
    { role: "assistant", content: "ביקשתי. יהיה ניסיון נוסף" },
  ]
}

const FOLLOW_UP =
  "צוהריים טובים,\nיש סיכוי לקבל את השטיח היום עד 18:00?"

describe("delivery coordination timing follow-up 313407519", () => {
  it("detects open delivery coordination service handoff thread", () => {
    assert.equal(
      isOpenDeliveryCoordinationServiceHandoffThread(history313407519()),
      true
    )
  })

  it("detects same-day timing follow-up", () => {
    assert.equal(
      isDeliveryCoordinationTimingFollowUp(history313407519(), FOLLOW_UP),
      true
    )
  })

  it("hints reply — not duplicate human_service", () => {
    const hints =
      buildConversationHints({
        history: history313407519(),
        body: FOLLOW_UP,
      }) ?? ""
    assert.match(hints, /DELIVERY COORDINATION TIMING FOLLOW-UP \(313407519\)/)
    assert.match(hints, /action: reply/i)
    assert.match(hints, /never.*human_service/i)
  })
})
