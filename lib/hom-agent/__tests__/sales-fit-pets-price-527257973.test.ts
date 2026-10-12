import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import { extractSalesIntake } from "@/lib/agents/sales-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

afterEach(() => {
  delete process.env.SALES_INTAKE_MODE
})

/** Replay 527257973 — size-fit ack after לא on pets; price ask before handoff. */
describe("sales fit pets price (527257973)", () => {
  const historyBeforeFitComment: HistoryMessage[] = [
    {
      role: "user",
      content:
        "היי אשמח לפרטים נוספים לגבי שטיח שאל פרסי 00 צבעוני 391*300 SHIRAZ",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nהיי! שמח שהתעניינת בשטיח שאל פרסי 00 צבעוני במידה 391*300. כדי שיועץ המכירות יוכל לעזור לך בדיוק, לאיזה חלל השטיח מיועד?",
    },
    { role: "user", content: "לסלון" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nאוקיי, קיבלתי. מה מידת הספה או הגודל הכללי של הסלון?",
    },
    { role: "user", content: "אני צריכה שטיח 3*4" },
    {
      role: "assistant",
      content: "*הום בוט :)*\nאוקיי, קיבלתי. האם אמור להתאים לבעלי חיים?",
    },
    { role: "user", content: "לא" },
  ]

  const fitBody = "אז הגודל מתאים לחלל אצלי בבית"

  it("extracts pets=none before size-fit comment turn", () => {
    const intake = extractSalesIntake(historyBeforeFitComment, fitBody)
    assert.equal(intake.pets, "none")
  })

  it("emits size-fit and pets hints on fit comment turn", () => {
    process.env.SALES_INTAKE_MODE = "llm"
    const hints = buildConversationHints({
      body: fitBody,
      history: historyBeforeFitComment,
      phone: "+972528888320",
    })
    assert.match(hints ?? "", /SALES SIZE FIT ACK \(527257973\)/i)
    assert.match(hints ?? "", /PETS ALREADY ANSWERED/i)
  })

  it("emits price hint when customer asked מה המחיר before handoff turn", () => {
    process.env.SALES_INTAKE_MODE = "llm"
    const historyBeforeHandoff: HistoryMessage[] = [
      ...historyBeforeFitComment,
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nמעולה — 391*300 קרוב ל-3*4. יש דרישות מיוחדות?",
      },
      { role: "user", content: "כן ברור" },
      {
        role: "assistant",
        content: "*הום בוט :)*\nמה הכי חשוב לך? קל לניקוי, עמידות, או משהו אחר?",
      },
      { role: "user", content: "הכל חשוב" },
      { role: "user", content: "מה המחיר" },
    ]
    const hints = buildConversationHints({
      body: "מה המחיר",
      history: historyBeforeHandoff.slice(0, -1),
      phone: "+972528888320",
    })
    assert.match(hints ?? "", /SALES PRICE ASK MID INTAKE \(527257973\)/i)
  })
})
