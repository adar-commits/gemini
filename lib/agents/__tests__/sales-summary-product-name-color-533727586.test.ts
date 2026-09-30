import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import { buildConfirmationSummary, extractSalesIntake } from "@/lib/agents/sales-intake"

/**
 * 533727586 — the product name "טרנדי 01 צבעוני" was read as a favored color
 * ("צבע מועדף וני") in the sales handoff summary although no color was given.
 */
const history: HistoryMessage[] = [
  {
    role: "user",
    content: "היי אשמח לפרטים נוספים לגבי שטיח טרנדי 01 צבעוני TRENDY שטיח טרנדי 01 צבעוני TRENDY",
    agent: null,
  },
  {
    role: "assistant",
    content:
      "*הום בוט :)*\nהיי יעל! בשמחה, טרנדי 01 הצבעוני הוא דגם יפה. לאיזה חלל את מחפשת את השטיח? סלון, חדר שינה, חדר ילדים או משהו אחר?",
    agent: "faq",
  },
  { role: "user", content: "חדר ילדים", agent: null },
  {
    role: "assistant",
    content: "*הום בוט :)*\nמעולה, טרנדי 01 הצבעוני יכול להתאים לחדר ילדים. מדובר בילדים קטנים, גדולים, או גם וגם?",
    agent: "faq",
  },
  { role: "user", content: "קטנים", agent: null },
  {
    role: "assistant",
    content: "*הום בוט :)*\nמעולה. מה בערך המידות של החדר? למשל 2×3 מ׳.",
    agent: "faq",
  },
  { role: "user", content: "כן אלה המידות", agent: null },
  {
    role: "assistant",
    content: "*הום בוט :)*\nמעולה, רשמתי חדר של בערך 2×3 מ׳. השטיח צריך להתאים גם לבעלי חיים?",
    agent: "faq",
  },
  { role: "user", content: "לא [תמונה][media:image:room1.jpg]", agent: null },
  {
    role: "assistant",
    content: "*הום בוט :)*\nאין בעיה. אפשר לשלוח תמונה אחת ברורה של החדר? זה יעזור ליועץ העיצוב. אם לא נוח, נמשיך בלי.",
    agent: "faq",
  },
]

describe("sales summary product-name color — 533727586", () => {
  it("does not read 'צבעוני' in the product name as a favored color", () => {
    const intake = extractSalesIntake(history, "[תמונה][media:image:room2.jpg]")
    assert.notEqual(intake.favoredColor, "וני")
    const summary = buildConfirmationSummary(intake)
    assert.doesNotMatch(summary, /צבע מועדף וני/)
  })

  it("still extracts an explicit favored color", () => {
    const intake = extractSalesIntake(
      [...history.slice(0, 3), { role: "user", content: "צבע מועדף תכלת", agent: null }],
      "צבע מועדף תכלת"
    )
    assert.equal(intake.favoredColor, "תכלת")
  })
})
