import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isHandoffOfferAbandonedInThread,
  isHumanHandoffPending,
} from "@/lib/agents/off-topic"
import { shouldSilentAutoAssignOnQuietWindow } from "@/lib/agents/inactivity-policy"
import type { HistoryMessage } from "@/lib/agents/types"

const HANDOFF_OFFER =
  "*הום בוט :)* בשמחה! מצטער, כרגע לא הצלחתי למשוך את הסטטוס העדכני של הזמנה #75304. הצפי שהיה לחידוש המלאי הוא בסביבות 09/10/2026, וכשהשטיח ייצא אליכם תגיע הודעת SMS עם החשבונית. להעביר לנציג שירות שיבדוק את הסטטוס העדכני?"

const FAQ_ANSWER =
  "*הום בוט :)* הודעת ה-SMS עם החשבונית נשלחת כשהשטיח כבר נארז למשלוח, כלומר הוא מוכן לצאת אליכם. אין מועד מדויק שנקבע מראש. חברת השליחויות מתקשרת ביום האספקה עצמו, לקראת ההגעה, כדי לתאם איתכם. אם ההודעה הגיעה ועבר זמן בלי שהשליח יצר קשר, אפשר לכתוב לנו כאן ונבדוק"

const GOODBYE =
  "*הום בוט :)* בשמחה טל, שבוע טוב ותתחדשו כשהשטיח יגיע 🙂"

/** Replay 534087362 — FAQ pivot + warm close must not silent-assign human_service later. */
describe("stale handoff after FAQ close 534087362", () => {
  const historyAfterFaqPivot: HistoryMessage[] = [
    { role: "user", content: "כן, תודה" },
    { role: "assistant", content: HANDOFF_OFFER },
    {
      role: "user",
      content: "אם קיבלנו הודעה עם החשבונית, תוך כמה זמן צפוי המשלוח?",
    },
    { role: "assistant", content: FAQ_ANSWER },
  ]

  const historyAfterWarmClose: HistoryMessage[] = [
    ...historyAfterFaqPivot,
    { role: "assistant", content: "*הום בוט :)* Tal Ben-Dayan, עדיין כאן?" },
    { role: "user", content: "הבנתי תודה" },
    { role: "assistant", content: GOODBYE },
  ]

  it("detects abandoned handoff after FAQ pivot", () => {
    assert.equal(isHandoffOfferAbandonedInThread(historyAfterFaqPivot), true)
    assert.equal(isHumanHandoffPending(historyAfterFaqPivot), false)
  })

  it("blocks silent auto-assign through warm close", () => {
    assert.equal(isHandoffOfferAbandonedInThread(historyAfterWarmClose), true)
    assert.equal(
      shouldSilentAutoAssignOnQuietWindow(historyAfterWarmClose, "faq"),
      false
    )
  })
})
