import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import {
  buildDocumentChannelQuestion,
  buildDocumentPurchaseLocationQuestion,
  isDocumentChannelUncertaintyAnswer,
  parseDocumentPurchaseChannel,
  resolveDigitalDocumentFlowReply,
} from "@/lib/agents/digital-document-flow"
import { buildPhoneLookupConfirmPrompt } from "@/lib/agents/order-lookup"

describe("digital document flow — receipt copy", () => {
  it("detects uncertainty on channel question", () => {
    assert.equal(isDocumentChannelUncertaintyAnswer("לא זוכר"), true)
    assert.equal(isDocumentChannelUncertaintyAnswer("לא יודעת"), true)
  })

  it("asks internet vs branch when customer does not remember fulfillment method", async () => {
    const history: HistoryMessage[] = [
      {
        role: "user",
        content: "אני צריך העתק של הקבלה שלי",
        agent: null,
      },
      {
        role: "assistant",
        content: buildDocumentChannelQuestion(),
        agent: "master",
      },
    ]

    const reply = await resolveDigitalDocumentFlowReply({
      body: "לא זוכר",
      phone: "+972547495083",
      history,
    })

    assert.match(reply, /מהאינטרנט\s+או\s+בסניף/)
    assert.doesNotMatch(reply, /באמצעות שליח/)
  })

  it("maps internet purchase to courier docs path", () => {
    assert.equal(parseDocumentPurchaseChannel("אינטרנט"), "website")
    assert.equal(parseDocumentPurchaseChannel("בסניף"), "store")
  })

  it("continues to phone confirm after internet vs branch answer", async () => {
    const history: HistoryMessage[] = [
      {
        role: "user",
        content: "אני צריך העתק של הקבלה שלי",
        agent: null,
      },
      {
        role: "assistant",
        content: buildDocumentChannelQuestion(),
        agent: "master",
      },
      { role: "user", content: "לא זוכר", agent: null },
      {
        role: "assistant",
        content: buildDocumentPurchaseLocationQuestion(),
        agent: "master",
      },
    ]

    const reply = await resolveDigitalDocumentFlowReply({
      body: "אינטרנט",
      phone: "+972547495083",
      history,
    })

    assert.match(reply, /0547-495083|495083/)
    assert.match(reply, /האם/)
  })

  it("fetches store invoice after soft phone confirm on current turn", async () => {
    const history: HistoryMessage[] = [
      {
        role: "user",
        content: "אשמח לקבל העתק של החשבונית שלי",
        agent: null,
      },
      {
        role: "assistant",
        content: buildDocumentChannelQuestion(),
        agent: "master",
      },
      { role: "user", content: "מהסניף", agent: null },
      {
        role: "assistant",
        content: buildPhoneLookupConfirmPrompt("+972547495083"),
        agent: "master",
      },
    ]

    const reply = await resolveDigitalDocumentFlowReply({
      body: "כן נראה לי",
      phone: "+972547495083",
      history,
    })

    assert.doesNotMatch(reply, /נציג שירות אנושי/)
  })
})
