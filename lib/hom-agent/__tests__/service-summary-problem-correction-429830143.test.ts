import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isServiceHandoffSummaryConfirmed,
  isServiceHandoffSummaryPending,
} from "@/lib/agents/service-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const FIRST_SUMMARY =
  "*הום בוט :)*\nתודה סופי, קיבלתי את התמונות של המדבקות. רואים עליהן את מספר ההזמנה ואת פרטי השטיח. כדי שהנציג לא יצטרך לשאול שוב, זה מה שאעביר לו:\n• מס׳ הזמנה: SO26024308\n• שטיח VEGA, דגם 64389, צבע 160 CREAM, מידה 140x190\n• השטיח התקבל היום\n• דיווח על בעיה לפי הלקוח: סיבים שבולטים לאורך השוליים והתפר בצד השטיח\n• נשלחו תמונות של השטיח ושל מדבקות האריזה\n• טלפון: 050-4548833\nזה מדויק, או שחסר משהו?"

const UPDATED_SUMMARY =
  "*הום בוט :)*\nתודה, עדכנתי. זו הפנייה המעודכנת שאעביר לנציג:\n• מס׳ הזמנה: SO26024308\n• שטיח VEGA, דגם 64389, צבע 160 CREAM, מידה 140x190\n• השטיח התקבל היום\n• הבעיה לפי הלקוחה: הגימור בשולי השטיח לא תקין ולא אחיד, וסיבים בולטים לאורך התפר בצד\n• נשלחו תמונות של השטיח ושל מדבקות האריזה\n• טלפון: 050-4548833\nעכשיו זה מדויק?"

const CORRECTION_FINISH = "הגימור בשוליים לא תקין לא אחיד"
const CORRECTION_NO_THREADS = "אין סיבים בולטים"

function historyThroughFirstSummary(): HistoryMessage[] {
  return [
    {
      role: "user",
      content: "יש פגם בשטיח שקיבלנו עכשיו [תמונה]",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* קיבלתי את התמונות… מבין את החשש, ונציג שירות יבדוק. יש לך מספר הזמנה?",
    },
    { role: "user", content: "כן [תמונה]" },
    {
      role: "assistant",
      content: FIRST_SUMMARY,
      awaiting: "service_summary_confirm",
    },
  ]
}

function historyThroughBadMerge(): HistoryMessage[] {
  return [
    ...historyThroughFirstSummary(),
    { role: "user", content: CORRECTION_FINISH },
    {
      role: "assistant",
      content: UPDATED_SUMMARY,
      awaiting: "service_summary_confirm",
    },
  ]
}

/** Replay 429830143 — problem-description corrections must replace bot inference, not merge. */
describe("service summary problem correction (429830143)", () => {
  it("detects service summary pending and treats refinements as corrections, not confirm", () => {
    const history = historyThroughBadMerge()
    assert.equal(isServiceHandoffSummaryPending(history), true)
    assert.equal(isServiceHandoffSummaryConfirmed(CORRECTION_FINISH, history), false)
    assert.equal(isServiceHandoffSummaryConfirmed(CORRECTION_NO_THREADS, history), false)
  })

  it("bad merged summary still mentions סיבים after customer denied them", () => {
    assert.match(UPDATED_SUMMARY, /סיבים בולטים/)
  })

  it("emits correction hint to replace problem line and drop contradicted inference", () => {
    const hints =
      buildConversationHints({
        history: historyThroughBadMerge(),
        body: CORRECTION_NO_THREADS,
      }) ?? ""
    assert.match(hints, /SERVICE SUMMARY CORRECTION \(429830143\)/)
    assert.match(hints, /ONLY their latest wording/)
    assert.match(hints, /remove סיבים/)
  })
})
