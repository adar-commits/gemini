import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import {
  isCommercialEntranceSalesThread,
  isCustomerRequestingProductPhotos,
} from "@/lib/agents/sales-intake"

function session535156475History(): HistoryMessage[] {
  return [
    { role: "user", content: "יש לכם שטיח לעסק?\nנגד החלקה וכאלה" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* בשמחה! איזה עסק זה ולאיזה חלל השטיח מיועד? למשל כניסה, אזור המתנה או משרד.",
    },
    {
      role: "user",
      content:
        "עסק של אוכל שיש הרבה תנועה המטרה היא שאנשים לא יחליקו בכניסה ויציאה מהעסק בחורף",
    },
    {
      role: "assistant",
      content: "*הום בוט :)* אוקיי, קיבלתי. מה מידת המיטה או הרהיט העיקרי בחדר?",
    },
    { role: "user", content: "1.50 בערך\nיש תמונות?" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* בשמחה — אפשר לשלוח תמונה אחת ברורה של החלל ואעביר ליועץ. האם אמור להתאים לבעלי חיים?",
    },
  ]
}

describe("commercial sales product photos 535156475", () => {
  it("detects commercial entrance thread from transcript", () => {
    const history = session535156475History()
    assert.equal(
      isCommercialEntranceSalesThread(history, "לא אני רוצה לקבל תמונות של הדטיח"),
      true
    )
  })

  it("detects customer asking for product photos not room upload", () => {
    assert.equal(
      isCustomerRequestingProductPhotos("לא אני רוצה לקבל תמונות של הדטיח"),
      true
    )
    assert.equal(isCustomerRequestingProductPhotos("יש תמונות?"), true)
  })

  it("hints commercial intake and product photos — not bedroom or room-photo loop", () => {
    const history = session535156475History()
    const body = "לא אני רוצה לקבל תמונות של הדטיח"
    const hints = buildConversationHints({ history, body })
    assert.ok(hints)
    assert.match(hints, /COMMERCIAL ENTRANCE SALES/i)
    assert.match(hints, /Never מידת מיטה/)
    assert.match(hints, /PRODUCT PHOTOS REQUEST/i)
    assert.match(hints, /carpetshop\.co\.il/)
    assert.doesNotMatch(hints, /lookup_order_status/)
  })
})
