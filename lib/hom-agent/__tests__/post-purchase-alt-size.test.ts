import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { pickHomAgentModel } from "@/lib/agent-core/hard-case-model"
import { executeLookupInventory } from "@/lib/hom-agent/tools/inventory"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runStructuredPostPurchaseAltSizePreTurn } from "@/lib/hom-agent/pre-turn"
import {
  buildPostPurchaseAlternateSizeAdvisorReply,
  isPostPurchaseAlternateSizeAvailabilityQuestion,
} from "@/lib/agents/post-purchase-alt-size"
import type { HistoryMessage } from "@/lib/agents/types"

const receiptHistory: HistoryMessage[] = [
  {
    role: "assistant",
    content:
      "שלום יונית עובד, 👋\nתודה על רכישתך בשטיח האדום, להלן קישור לקבלה הדיגיטלית שלך:\nhttps://documents.carpetshop.co.il/documents/f9bc45bd-2ea6-4073-8f2e-7ee850ddec01\n\nלמעקב אחר התקדמות ההזמנה, יש ללחוץ כאן:\nhttps://tracking.carpetshop.co.il/track?orderID=SO26022330",
  },
]

describe("post-purchase alternate size (532256198)", () => {
  it("detects same-model different-size ask after purchase", () => {
    assert.equal(
      isPostPurchaseAlternateSizeAvailabilityQuestion(
        "היי,יש את השטיח שבחרתי 3 מטר על 2?",
        receiptHistory
      ),
      true
    )
    assert.equal(
      isPostPurchaseAlternateSizeAvailabilityQuestion(
        "האם השטיח שרכשתי היום קיים במידה 3 מטר על 2 מטר?",
        receiptHistory
      ),
      true
    )
  })

  it("pre-turn offers sales advisor instead of SKU loop", async () => {
    const result = runStructuredPostPurchaseAltSizePreTurn({
      turn: {
        text: "היי,יש את השטיח שבחרתי 3 מטר על 2?",
        media: [],
      },
      history: receiptHistory,
    })

    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.match(result.reply, /יועץ מכירות/)
    assert.match(result.reply, /לא יכול לזהות/)
    assert.doesNotMatch(result.reply, /31503138/)
  })

  it("pre-turn acks photo without SKU extraction", () => {
    const history: HistoryMessage[] = [
      ...receiptHistory,
      {
        role: "user",
        content: "היי,יש את השטיח שבחרתי 3 מטר על 2?",
      },
      {
        role: "assistant",
        content: buildPostPurchaseAlternateSizeAdvisorReply(),
      },
    ]

    const result = runStructuredPostPurchaseAltSizePreTurn({
      turn: { text: "", media: [{ kind: "image", url: "https://example.com/photo.jpg" }] },
      history,
    })

    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.match(result.reply, /קיבלתי את התמונה/)
    assert.doesNotMatch(result.reply, /כרטיס מתנה/)
  })

  it("refuses inventory lookup without SKU", async () => {
    const result = await executeLookupInventory({
      body: "האם השטיח שרכשתי היום קיים במידה 3 מטר על 2 מטר?",
      history: receiptHistory,
    })

    assert.equal(result.ok, false)
    assert.equal((result as { errorCode?: string }).errorCode, "inventory_misroute")
    assert.match((result as { error: string }).error, /human_sales/)
  })

  it("adds post-purchase alt size hint", () => {
    const hints = buildConversationHints({
      history: receiptHistory,
      body: "היי,יש את השטיח שבחרתי 3 מטר על 2?",
    })

    assert.ok(hints)
    assert.match(hints, /POST-PURCHASE ALT SIZE/i)
    assert.match(hints, /human_sales/)
  })

  it("escalates to Opus on post-purchase alt size", () => {
    const pick = pickHomAgentModel({
      body: "היי,יש את השטיח שבחרתי 3 מטר על 2?",
      turn: { text: "היי,יש את השטיח שבחרתי 3 מטר על 2?", media: [] },
      history: receiptHistory,
      defaultModel: "anthropic/claude-sonnet-4.5",
    })

    assert.equal(pick.escalated, true)
    assert.match(pick.reason, /post_purchase_alt_size/)
  })
})
