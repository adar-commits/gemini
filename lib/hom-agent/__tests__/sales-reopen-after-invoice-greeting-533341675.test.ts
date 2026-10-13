import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { lastAssistantWasOutboundDocumentDelivery } from "@/lib/agents/digital-document-flow"
import { runStructuredOpeningAfterDocumentDeliveryPreTurn } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

const BAD_REPLY =
  "*הום בוט :)*\nהיי לאה!\n\nהפנייה שלך על שטיח סולו 02 קורל (מק״ט 21902303-200290) עוברת עכשיו ליועץ מכירות."

const INVOICE =
  "שלום לאה דיאן 👋, תודה על רכישתך בשטיח האדום, להלן קישור לחשבונית מס קבלה הדיגיטלית שלך: https://documents.carpetshop.co.il/documents/e5e87566-66ba-4b15-88a2-0166afa18be9 נשמח לעמוד לרשותך בכל שאלה בערוצי הדיגיטל שלנו - תתחדשו ❤️"

function fullThread533341675(): HistoryMessage[] {
  return [
    { role: "user", content: "היי אשמח לפרטים נוספים לגבי שטיח סולו 02 קורל" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* מועד חידוש המלאי של סולו 02 קורל לא מופיע אצלי. תשלחי לי את המק״ט?",
    },
    { role: "user", content: "21902303-200290" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* יש כרגע תקלה זמנית במערכת. להעביר ליועץ מכירות?",
    },
    { role: "user", content: "כן בבקשה" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* כרגע אין יועצי מכירות זמינים, אבל אל דאגה — קיבלנו את הפנייה.",
    },
    { role: "assistant", content: "אין את השטיח.. נשאר רק מידה 160*230" },
    { role: "assistant", content: INVOICE },
  ]
}

/** Replay 533341675 — bare היי after purchase invoice must not re-handoff stale Solo stock inquiry. */
describe("sales reopen after invoice greeting 533341675", () => {
  it("visit-only history misses invoice — full thread has document delivery", () => {
    const visitOnly: HistoryMessage[] = [{ role: "user", content: "היי" }]
    assert.equal(lastAssistantWasOutboundDocumentDelivery(visitOnly), false)
    assert.equal(lastAssistantWasOutboundDocumentDelivery(fullThread533341675()), true)
  })

  it("pre-turn opening on full thread after invoice", () => {
    const result = runStructuredOpeningAfterDocumentDeliveryPreTurn({
      turn: { text: "היי", media: [] },
      history: fullThread533341675(),
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "reply")
    assert.match(result.reply, /היי/)
    assert.doesNotMatch(result.reply, /סולו/)
    assert.doesNotMatch(result.reply, /יועץ מכירות/)
  })

  it("bad production reply re-handoffed stale sales case", () => {
    assert.match(BAD_REPLY, /סולו 02 קורל/)
    assert.match(BAD_REPLY, /יועץ מכירות/)
  })
})
