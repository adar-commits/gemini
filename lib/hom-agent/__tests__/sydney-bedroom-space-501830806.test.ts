import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { shouldUseSalesIntakeFastPath } from "@/lib/agents/sales-intake"
import { runStructuredSalesIntakePreTurn } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

afterEach(() => {
  delete process.env.SALES_INTAKE_MODE
})

/** 501830806 — Sydney catalog compare: לחדר שינה + photo must not trigger bedroom sub-type question. */
describe("sydney bedroom space answer 501830806", () => {
  const historyBeforeBedroomAnswer: HistoryMessage[] = [
    {
      role: "user",
      content:
        "היי אשמח לפרטים נוספים לגבי שטיח סידני 03 קרם-אפור SYDNEY ומה ההבדל בינו לבין סידני 08 קרם-אפור?",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nהיי אמיר!\n\nשני הדגמים מקולקציית סידני ובאותו גוון קרם-אפור. את ההבדלים המדויקים ביניהם (עיצוב, עובי וחומר) יועץ המכירות יפרט לך, ויוכל גם לתת המלצה מתי לבחור כל אחד.\n\nכדי שיגיע אליך מוכן, כמה שאלות קצרות. לאיזה חלל השטיח מיועד?",
    },
  ]

  const bedroomPhotoTurn = {
    text: "לחדר שינה",
    media: [
      {
        type: "image" as const,
        url: "https://storage.googleapis.com/media.landbot.io/256062/customers/501619719/FQ56BMCSP4WBMH87RHY3NNLBZPUV81Z6.jpg",
      },
    ],
  }

  it("hints against bedroom sub-type re-ask", () => {
    const hints = buildConversationHints({
      history: historyBeforeBedroomAnswer,
      body: `${bedroomPhotoTurn.text} [media:image:${bedroomPhotoTurn.media[0].url}]`,
      lastAgent: "sales",
    })
    assert.match(hints ?? "", /BEDROOM SPACE COMPLETE \(501830806\)/)
  })

  it("advances intake on לחדר שינה instead of bedroom sub-type question", () => {
    process.env.SALES_INTAKE_MODE = "llm"
    assert.equal(
      shouldUseSalesIntakeFastPath(
        bedroomPhotoTurn.text,
        historyBeforeBedroomAnswer,
        "sales"
      ),
      true
    )

    const result = runStructuredSalesIntakePreTurn({
      turn: bedroomPhotoTurn,
      history: historyBeforeBedroomAnswer,
      lastAgent: "sales",
    })

    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "reply")
    assert.match(result.reply, /מיטה|רהיט|בעלי חיים|תמונה/i)
    assert.doesNotMatch(result.reply, /החדר משמש|תינוקות|ילדים.*זוגי/i)
  })
})
