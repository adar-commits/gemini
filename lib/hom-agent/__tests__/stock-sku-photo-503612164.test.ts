import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"

/** Replay 503612164 — product-page photo after SKU ask must continue stock flow, not human_sales. */
describe("stock sku photo 503612164", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "היי", agent: null },
    {
      role: "user",
      content: "אני רוצה את שטיח טוקיו הוא אזל מהמלאi?",
      agent: null,
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* היי שלומית! אני יכול לבדוק לך את המלאi של טוקיו בסניפים. לשם כך אני צריך את המק״ט של המידה שאת רוצה. הוא מופיע בעמוד המוצר באתר (לדוגמה: 31503138-200290). איזו מידה רצית? אם יש לך את המק״ט, אפשר לשלוח אותו כאן.",
      agent: "faq",
    },
  ]

  const imageBody =
    "[תמונה][media:image:https://storage.googleapis.com/media.landbot.io/256062/customers/503399082/96R2FE4XT5CVPCF4DJDA6QMR1JI61QHS.jpg]"

  it("hints typed SKU request instead of generic photo handoff", () => {
    const hints = buildConversationHints({
      history,
      body: imageBody,
      whatsappPhone: "+972548038030",
    })
    assert.match(hints ?? "", /INVENTORY SKU PHOTO/i)
    assert.match(hints ?? "", /lookup_inventory/)
    assert.doesNotMatch(
      hints ?? "",
      /PHOTO RECEIVED.*533695023.*human_sales/is
    )
  })
})
