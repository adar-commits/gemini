import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isPostPurchaseAlternateSizeAvailabilityQuestion,
  isShippingAddressChangeAsk,
} from "@/lib/agents/post-purchase-alt-size"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runStructuredPostPurchaseAltSizePreTurn } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

const RECEIPT = `שלום דולב אשתמקר 👋,
תודה על רכישתך בשטיח האדום, להלן קישור לקבלה הדיגיטלית שלך:
https://documents.carpetshop.co.il/documents/4b0d43e5-b124-4ef6-a2ad-7073ca63ffc0`

const ASK = `היי, צריך לשנות כתובת להזמנה שאני מחכה לה.
הזמנה על שמי - דולב אשתמקר
להחליף לכתובת יקינטון 16 דירה 16, חריש.

בנוסף רוצה לדעת מתי היא צפויה להגיע כי עבר חודש מההזמנה.

תודה`

/** 529942717 — להחליף לכתובת is an address change, not a size/stock check. */
describe("address change is not stock 529942717", () => {
  const history: HistoryMessage[] = [
    { role: "assistant", content: RECEIPT },
    { role: "user", content: ASK },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nקודם אמצא את ההזמנה שלכם בזריזות, האם היא רשומה על המספר ממנו אני מתכתב כרגע? (052-3467459)\nאם לא, אשמח לקבל אותו.",
    },
  ]

  it("does not treat להחליף לכתובת as alternate size", () => {
    assert.equal(isShippingAddressChangeAsk(ASK, [{ role: "assistant", content: RECEIPT }]), true)
    assert.equal(
      isPostPurchaseAlternateSizeAvailabilityQuestion(ASK, [
        { role: "assistant", content: RECEIPT },
      ]),
      false
    )
    assert.equal(isPostPurchaseAlternateSizeAvailabilityQuestion("כן", history), false)
  })

  it("still detects a real same-model size ask", () => {
    assert.equal(
      isPostPurchaseAlternateSizeAvailabilityQuestion(
        "האם השטיח שרכשתי היום קיים במידה 3 מטר על 2 מטר?",
        [{ role: "assistant", content: RECEIPT }]
      ),
      true
    )
  })

  it("כן after phone confirm does not become the stock reply", () => {
    const result = runStructuredPostPurchaseAltSizePreTurn({
      turn: { text: "כן", media: [] },
      history,
    })
    assert.equal(result.kind, "skip")
  })

  it("hints address change and not alternate size", () => {
    const hints = buildConversationHints({
      body: ASK,
      history: [{ role: "assistant", content: RECEIPT }],
    })
    assert.match(hints ?? "", /529942717/)
    assert.match(hints ?? "", /delivery-address change/)
    assert.doesNotMatch(hints ?? "", /POST-PURCHASE ALT SIZE/)
  })
})
