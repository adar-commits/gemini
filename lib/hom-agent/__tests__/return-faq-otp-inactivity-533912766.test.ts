import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { hasOpenFaqFollowUpQuestion } from "@/lib/agents/inactivity-policy"
import { shouldSilentAutoAssignOnQuietWindow } from "@/lib/agents/inactivity-policy"
import type { HistoryMessage } from "@/lib/agents/types"

const RETURN_FAQ =
  "*הום בוט :)* בוקר טוב לימור, חבל שהמידה לא התאימה לחדר השינה. השטיח הגיע ביום חמישי, אז את עדיין בתוך 14 הימים. יש שתי אפשרויות: 1. *החלפה*: בוחרים שטיח במידה שמתאימה יותר לחדר. 2. *החזרה וביטול*: מחזירים באחד מ*סניפי הרשת* בלי עלות. במסלול הזה חייבים קודם לפתוח בקשה בפורטל. מה מתאים לך יותר?"

const OTP =
  "‏*662856*‏ הוא קוד האימות שלך. מטעמי אבטחה, אין לשתף את הקוד הזה."

const PING = "*הום בוט :)* לימור אמיר, עדיין כאן?"

/** Replay 533912766 — exchange/return FAQ + OTP must stay an open FAQ thread (no silent handoff). */
describe("return FAQ OTP inactivity 533912766", () => {
  const historyAfterOtp: HistoryMessage[] = [
    {
      role: "user",
      content:
        "הזמנתי שטיח והגיע אלי יום חמישי גודל השטיח לא מתאים לחדר השינה מבקשת להחזיר את המוצר בבקשה",
    },
    { role: "assistant", content: RETURN_FAQ, agent: "faq" },
    { role: "assistant", content: OTP },
  ]

  const historyAfterPing: HistoryMessage[] = [
    ...historyAfterOtp,
    { role: "assistant", content: PING, agent: "master" },
  ]

  it("still detects open FAQ after procedural OTP", () => {
    assert.equal(hasOpenFaqFollowUpQuestion(historyAfterOtp, "faq"), true)
    assert.equal(hasOpenFaqFollowUpQuestion(historyAfterPing, "master"), true)
  })

  it("does not silent-assign while exchange vs return is unanswered", () => {
    assert.equal(shouldSilentAutoAssignOnQuietWindow(historyAfterOtp, "faq"), false)
    assert.equal(shouldSilentAutoAssignOnQuietWindow(historyAfterPing, "master"), false)
  })
})
