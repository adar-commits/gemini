import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runStructuredSalesPhotoPreTurn } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

describe("sales handoff on summary (532408613 — Astra smaller size)", () => {
  const historyBeforePhoto: HistoryMessage[] = [
    {
      role: "user",
      content:
        "היי אשמח לפרטים נוספים לגבי שטיח אסטרה 03 קרם/בז' ASTRA\nיש יותר קטן?",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nהיי! שמח שהתעניינתם בשטיח אסטרה 03…\n\nלאיזה חלל מיועד השטיח?",
    },
    { role: "user", content: "לסלון" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nמעולה, לסלון\n\nכדי שהיועץ יוכל להתאים בול, אפשר לשתף מידות הסלון בערך או גודל הספה?",
    },
    { role: "user", content: "הזפה 3 מ רוחב" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nתודה, רשמתי — ספה ברוחב 3 מ'.\n\nהשטיח אמור להתאים גם לבעלי חיים בבית?",
    },
    { role: "user", content: "כן" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nמעולה, רשמתי גם את זה.\n\nאפשר לשלוח תמונה אחת ברורה של הסלון? זה יעזור ליועץ העיצוב להתאים את ההמלצה. אם לא נוח — אין בעיה, אפשר לדלג.",
    },
  ]

  it("assigns human_sales on photo turn when intake reaches summary (532408613 replay)", () => {
    const result = runStructuredSalesPhotoPreTurn({
      turn: {
        text: "[media:image:https://storage.googleapis.com/media.landbot.io/example.jpg]",
        media: [{ kind: "image", url: "https://example.com/room.jpg" }],
      },
      history: historyBeforePhoto,
      lastAgent: "faq",
    })

    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "human_sales")
    assert.match(result.reply, /לסיכום/)
    assert.match(result.reply, /מעביר/)
    assert.doesNotMatch(result.reply, /אני צודק/i)
  })

  it("hints sales thread and immediate handoff on ongoing intake", () => {
    const hints = buildConversationHints({
      body: "לסלון",
      history: historyBeforePhoto.slice(0, 2),
      phone: "0542082048",
    })
    assert.match(hints ?? "", /SALES THREAD \(מכירות\)/i)
    assert.match(hints ?? "", /crm_department.*sales/i)
    assert.match(hints ?? "", /human_sales in the \*\*same\*\* JSON/i)
  })
})
