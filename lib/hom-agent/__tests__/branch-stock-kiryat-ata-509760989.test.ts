import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildInventoryAvailabilityReply } from "@/lib/agents/inventory-lookup"
import type { HistoryMessage } from "@/lib/agents/types"
import {
  hasStructuredPendingStateBinding,
  shouldDeferStructuredPreTurnToLlm,
} from "@/lib/hom-agent/opening-turn-llm"

/** 509760989 — branch stock ask at קריית אתא; SKU follow-up must keep branch context. */
describe("branch stock kiryat ata 509760989", () => {
  const history: HistoryMessage[] = [
    {
      role: "user",
      content: "היי אשמח לפרטים נוספים לגבי שטיח אטלס 22 קרם ATLAS",
      agent: null,
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* היי דניאל! בשמחה, אשמח לעזור עם אטלס 22 בצבע קרם כדי שיועץ המכירות יוכל להתאים את הפרטים, לאיזה חלל השטיח מיועד? למשל סלון, חדר שינה או חדר ילדים.",
      agent: "faq",
    },
    {
      role: "user",
      content: "האם יש במלאי בסניף קרית אתא מידה 2 על 3 מטר?",
      agent: null,
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* כדי לבדוק מלאי בסניף קריית אתא צריך את המק״ט של אטלס 22 קרם במידה שמעניינת אותך. הוא מופיע בעמוד המוצר באתר, אחרי שבוחרים את המידה (לדוגמה: 31503138-200290). אפשר לשלוח אותו כאן? אם קשה למצוא אותו, יועץ מכירות יכול לבדוק בשבילך.",
      agent: "faq",
    },
  ]

  const skuTurn = { text: "06522090-200290", media: [] as [] }

  it("binds SKU reply to pending inventory pre-turn instead of LLM-only defer", () => {
    assert.equal(
      hasStructuredPendingStateBinding(history, skuTurn, skuTurn.text),
      true
    )
    assert.equal(shouldDeferStructuredPreTurnToLlm(history, skuTurn), false)
  })

  it("uses branch-specific no-stock wording, not generic בסניפים", () => {
    const reply = buildInventoryAvailabilityReply(
      {
        sku: "06522090-200290",
        preorder: null,
        inventory: [{ branch_id: "30", displayName: "קריית אתא", quantity: 0 }],
      },
      "קריית אתא"
    )
    assert.match(reply, /בסניף קריית אתא/)
    assert.match(reply, /לא מופיע מלאי בסניף קריית אתא/)
    assert.doesNotMatch(reply, /בסניפים/)
  })
})
