import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isOutboundDocumentDeliveryMessage,
  lastAssistantWasOutboundDocumentDelivery,
} from "@/lib/agents/digital-document-flow"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runStructuredOpeningAfterDocumentDeliveryPreTurn } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

const documentTemplateHistory: HistoryMessage[] = [
  {
    role: "assistant",
    content:
      "שלום הלן קוגן 👋,\nתודה על רכישתך בשטיח האדום, להלן קישור לחשבונית מס הדיגיטלית שלך:\nhttps://documents.carpetshop.co.il/documents/b521b645-4792-4ac4-96af-e4357e4d1a24\n\nנשמח לעמוד לרשותך בכל שאלה בערוצי הדיגיטל שלנו - תתחדשו ❤️",
  },
]

describe("greeting after outbound document delivery (530142668)", () => {
  it("detects Weezmo invoice/receipt template messages", () => {
    assert.equal(
      isOutboundDocumentDeliveryMessage(documentTemplateHistory[0]!.content),
      true
    )
    assert.equal(
      lastAssistantWasOutboundDocumentDelivery(documentTemplateHistory),
      true
    )
  })

  it("pre-turn restarts with opening greeting on היי", () => {
    const result = runStructuredOpeningAfterDocumentDeliveryPreTurn({
      turn: { text: "היי", media: [] },
      history: documentTemplateHistory,
    })

    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.match(result.reply, /היי/)
    assert.match(result.reply, /עזור/)
    assert.doesNotMatch(result.reply, /בשמחה! אם יעלה/)
  })

  it("hints fresh start instead of wait ping", () => {
    const hints = buildConversationHints({
      history: documentTemplateHistory,
      body: "היי",
    })

    assert.ok(hints)
    assert.match(hints, /FRESH START after invoice\/receipt delivery/i)
    assert.doesNotMatch(hints, /WAIT PING/i)
  })
})
