import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildPostPurchaseAlternateSizeAdvisorReply,
  isPostPurchaseAlternateSizeThread,
  isPostPurchaseDifferentModelOrPackagingExchange,
} from "@/lib/agents/post-purchase-alt-size"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runStructuredPostPurchaseAltSizePreTurn } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

/** Replay 534041229 — wrong-model exchange + packaging; «פתחתי» must not trigger alt-size pre-turn. */
describe("exchange packaging not alt-size (534041229)", () => {
  const history: HistoryMessage[] = [
    {
      role: "user",
      content:
        "היי, שמי נגה. קיבלתי היום שטיח שהזמנתי. השטיח בכלל לא דומה לשטיח שרציתי. איך אפשר לבצע החלפה?",
    },
    {
      role: "assistant",
      content:
        "חבל שהשטיח לא דומה למה שרצית, נמשיך עם החלפה. אפשר להחליף עד 14 יום — ללא שימוש, באריזתו המקורית. רק לוודא: מדובר בהזמנה SO26024683?",
    },
    { role: "user", content: "הגזמתם במחיר" },
    {
      role: "user",
      content: "איך יהיה באריזתו המקורית? פתלתי אותו כדי לראות",
    },
    {
      role: "assistant",
      content:
        "ניתן לבצע החלפה בתוך 14 יום — ללא שימוש, באריזתו המקורית. דמי שליח לפי גודל השטיח.",
    },
  ]

  const openedWithPhoto =
    "פתחתי\n[media:image:https://storage.googleapis.com/media.landbot.io/example.jpg]"

  it("detects different-model / packaging exchange thread", () => {
    assert.equal(isPostPurchaseDifferentModelOrPackagingExchange(openedWithPhoto, history), true)
  })

  it("does not route packaging photo turn to post-purchase alt-size pre-turn", () => {
    assert.equal(isPostPurchaseAlternateSizeThread(history, openedWithPhoto), false)

    const preTurn = runStructuredPostPurchaseAltSizePreTurn({
      turn: {
        text: openedWithPhoto,
        media: [{ kind: "image", url: "https://example.com/rug.jpg" }],
      },
      history,
    })
    assert.equal(preTurn.kind, "skip")
  })

  it("adds exchange packaging hint, not POST-PURCHASE ALT SIZE", () => {
    const hints = buildConversationHints({ history, body: openedWithPhoto })
    assert.ok(hints)
    assert.match(hints, /EXCHANGE DIFFERENT MODEL \/ PACKAGING \(534041229\)/)
    assert.doesNotMatch(hints, /POST-PURCHASE ALT SIZE/)
  })

  it("still allows true alt-size asks after purchase", () => {
    const receiptOnly: HistoryMessage[] = [
      {
        role: "assistant",
        content:
          "https://tracking.carpetshop.co.il/track?orderID=SO26024683",
      },
    ]
    assert.equal(
      isPostPurchaseAlternateSizeThread(
        receiptOnly,
        "האם השטיח שרכשתי קיים במידה 200×290?"
      ),
      true
    )
    assert.doesNotMatch(
      buildPostPurchaseAlternateSizeAdvisorReply(),
      /לא דומה/
    )
  })
})
