import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import { buildConfirmationSummary, extractSalesIntake } from "@/lib/agents/sales-intake"

/**
 * 533497646 — the sales handoff summary said "שטיח בגודל 3 מטר" (3 m was the sofa,
 * later corrected to 3.20) and "בסגנון לפי צבע מועדף" although style was never asked.
 */
const history: HistoryMessage[] = [
  { role: "user", content: "מחפשת שטיח לסלון", agent: null },
  {
    role: "assistant",
    content: "*הום בוט :)*\nמה מידת הספה או הגודל הכללי של הסלון?",
    agent: "sales",
  },
  { role: "user", content: "3 מטר", agent: null },
  { role: "user", content: "3.20", agent: null },
  {
    role: "assistant",
    content: "*הום בוט :)*\nהאם אמור להתאים לבעלי חיים?",
    agent: "sales",
  },
  { role: "user", content: "לא", agent: null },
  {
    role: "assistant",
    content: "*הום בוט :)*\nאפשר לשלוח תמונה אחת ברורה של החלל? זה יעזור ליועץ העיצוב.",
    agent: "sales",
  },
]

describe("sales summary sofa size — 533497646", () => {
  it("uses the corrected sofa size and never labels it as the rug size", () => {
    const summary = buildConfirmationSummary(extractSalesIntake(history, "[media:image:room.jpg]"))
    assert.match(summary, /ספה של כ-3\.20 מ׳/)
    assert.doesNotMatch(summary, /בגודל 3 מטר/)
    assert.doesNotMatch(summary, /שטיח[^,]*בגודל/)
  })

  it("does not invent a style the customer was never asked about", () => {
    const summary = buildConfirmationSummary(extractSalesIntake(history, "[media:image:room.jpg]"))
    assert.doesNotMatch(summary, /סגנון/)
  })

  it("does not print 'בסגנון לפי צבע מועדף' when only a color was volunteered", () => {
    const intake = extractSalesIntake(history, "[media:image:room.jpg]")
    intake.favoredColor = "אפור"
    intake.style = "לפי צבע מועדף"
    const summary = buildConfirmationSummary(intake)
    assert.doesNotMatch(summary, /לפי צבע מועדף/)
  })

  it("keeps an explicit rug size (240/330) over the sofa size", () => {
    const summary = buildConfirmationSummary(
      extractSalesIntake(
        [
          ...history.slice(0, 3),
          { role: "user", content: "רוצה 240/330", agent: null },
        ],
        "240/330"
      )
    )
    assert.match(summary, /240\/330/)
  })
})
