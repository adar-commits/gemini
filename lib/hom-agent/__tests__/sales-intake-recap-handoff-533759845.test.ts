import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isSalesIntakeCompleteWithOptionalPhotoPending,
  isSalesPhotoRequestPending,
} from "@/lib/agents/sales-intake"
import type { HistoryMessage } from "@/lib/agents/types"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runStructuredSalesPhotoPreTurn } from "@/lib/hom-agent/pre-turn"

/** 533759845 — BELL CREAM sales intake: recap + optional photo, customer waited, no human_sales. */
describe("sales intake recap handoff 533759845", () => {
  const historyBeforeWaiting: HistoryMessage[] = [
    {
      role: "user",
      content: "היי אשמח לפרטים נוספים לגבי שטיח בל קרם BELL",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nהיי ריקי! בשמחה, נעזור עם שטיח בל קרם. כדי שיועץ המכירות יוכל לתת את הפרטים שמתאימים לך, שאלה קצרה קודם: לאיזה חלל השטיח מיועד? סלון, חדר שינה, חדר ילדים או משהו אחר?",
    },
    { role: "user", content: "המרצפות שלי בצבע קרם מקווה שהשטיח יראה.הריהוט בצבע חום" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nתודה, זה חשוב. אציין ליועץ שהמרצפות בצבע קרם והריהוט חום, ושחשוב שהשטיח יבלוט על הרצפה. באיזה חדר השטיח יהיה? סלון, חדר שינה או חדר אחר?",
    },
    { role: "user", content: "השטיח לסלון" },
    { role: "user", content: "בסלון" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nמעולה, סלון. מה בערך המידות של הסלון, או לפחות האורך של הספה? (למשל ספה של 2.5 מ׳ או חדר של 4×5 מ׳)",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nכן, הבנתי שהשטיח לסלון אם אין כרגע מידות מדויקות, זה בסדר. יועץ המכירות יעזור עם זה. יש בבית בעלי חיים שהשטיח צריך להתאים להם?",
    },
    { role: "user", content: "אורך הספה 2מטרוחצי\nלא אין\nרק שני מבוגרים" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nמעולה, רשמתי: ספה של 2.5 מ׳, בלי בעלי חיים, ושני מבוגרים בבית.\n\nאם אפשר, שלחו תמונה אחת ברורה של הסלון. היא תעזור ליועץ העיצוב לראות איך בל קרם ייראה עם המרצפות והריהוט. אם לא נוח, זה בסדר גמור.",
    },
  ]

  it("detects optional photo pending after intake recap", () => {
    assert.equal(isSalesPhotoRequestPending(historyBeforeWaiting), true)
    assert.equal(isSalesIntakeCompleteWithOptionalPhotoPending(historyBeforeWaiting), true)
  })

  it("assigns human_sales when customer says they sent a photo (533759845 replay)", () => {
    const result = runStructuredSalesPhotoPreTurn({
      turn: { text: "שלחתי תמונה ..", media: [] },
      history: historyBeforeWaiting,
      lastAgent: "faq",
    })

    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "human_sales")
    assert.match(result.reply, /מעביר|אעביר/i)
  })

  it("assigns human_sales when customer is waiting for the advisor", () => {
    const history = [
      ...historyBeforeWaiting,
      { role: "user", content: "תודה לכם." },
    ]
    const result = runStructuredSalesPhotoPreTurn({
      turn: { text: "מחכה לתשובה תודה", media: [] },
      history,
      lastAgent: "faq",
    })

    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "human_sales")
  })

  it("hints immediate human_sales on follow-up after recap + optional photo", () => {
    const hints = buildConversationHints({
      body: "מחכה לתשובה תודה",
      history: historyBeforeWaiting,
      whatsappPhone: "+972547495083",
    })
    assert.match(hints ?? "", /SALES RECAP \+ OPTIONAL PHOTO/i)
    assert.match(hints ?? "", /human_sales/i)
    assert.match(hints ?? "", /never invent/i)
  })
})
