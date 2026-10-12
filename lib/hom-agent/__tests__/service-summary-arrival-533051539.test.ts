import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isServiceHandoffSummaryPending,
  isServiceSummaryPhysicalArrivalQuestion,
  threadHasUnansweredPhysicalArrivalQuestion,
} from "@/lib/agents/service-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"

const SUMMARY =
  "*הום בוט :)* סליחה מלכה, אני כאן. מבין שקיבלת שטיח בצבע אחר ממה שהזמנת. כדי שהנציג לא יצטרך לשאול שוב, זה מה שאעביר לו: • מס׳ הזמנה: #77540 • לפי הלקוחה: הגיע שטיח בגוון דהוי (חום-אפור) ולא בצבע החום שהוזמן • הלקוחה מבקשת שיאספו את השטיח ממנה בלי עלות אם יש לך אפשרות, אפשר לשלוח תמונה אחת ברורה של השטיח שהגיע. זה יעזור לנציג. זה מדויק, או שחסר משהו?"

const CUSTOMER_ARRIVAL =
  "לא ענית לי על השאלה המשלוח  היגע אלי"

const BAD_SUMMARY_ONLY = SUMMARY

const GOOD_ARRIVAL_OPEN =
  "*הום בוט :)* כן מלכה — השטיח הגיע אלייך. מועד האיסוף מתאם נציג שירות."

/** Replay 533051539 — physical arrival question must not get recap-only. */
describe("service summary physical arrival (533051539)", () => {
  it("detects physical arrival challenge while service summary pending", () => {
    const history = [
      { role: "user", content: "המשלוח הגיע אלי?" },
      { role: "assistant", content: SUMMARY },
    ]
    assert.equal(isServiceHandoffSummaryPending(history), true)
    assert.equal(
      isServiceSummaryPhysicalArrivalQuestion(CUSTOMER_ARRIVAL, history),
      true
    )
  })

  it("flags unanswered physical arrival before recap is sent", () => {
    const history = [{ role: "user", content: "המשלוח הגיע אלי?" }]
    assert.equal(threadHasUnansweredPhysicalArrivalQuestion(history), true)
  })

  it("bad reply opened service recap without confirming arrival", () => {
    assert.doesNotMatch(BAD_SUMMARY_ONLY, /הגיע\s+אל/i)
  })

  it("good reply answers physical arrival before pickup logistics", () => {
    assert.match(GOOD_ARRIVAL_OPEN, /הגיע\s+אל/i)
  })

  it("emits physical-arrival hint for pending summary", () => {
    const history = [
      { role: "user", content: "המשלוח הגיע אלי?" },
      { role: "assistant", content: SUMMARY },
    ]
    const hints =
      buildConversationHints({
        history,
        body: CUSTOMER_ARRIVAL,
      }) ?? ""
    assert.match(hints, /SERVICE SUMMARY PHYSICAL ARRIVAL \(533051539\)/)
  })
})
