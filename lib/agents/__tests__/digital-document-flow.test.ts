import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import {
  buildDocumentPhoneConfirmPrompt,
  buildDocumentTypeQuestion,
  inferDocumentIntent,
  isDigitalDocumentRequest,
  isDocumentChannelUncertaintyAnswer,
  isOrderLineItemVerificationRequest,
  parseDocumentPurchaseChannel,
  parseDocumentTypeFromText,
  resolveDigitalDocumentFlowReply,
} from "@/lib/agents/digital-document-flow"

describe("digital document flow — receipt copy", () => {
  it("detects common invoice phrasing including אפשר לקבל and לשלוח", () => {
    assert.equal(isDigitalDocumentRequest("אפשר לקבל חשבונית?"), true)
    assert.equal(
      isDigitalDocumentRequest("אפשר לשלוח בבקשה חשבונית מס?"),
      true
    )
    assert.equal(isDigitalDocumentRequest("אני צריך העתק של הקבלה שלי"), true)
  })

  it("skips type question when customer already specified חשבונית מס", async () => {
    const reply = await resolveDigitalDocumentFlowReply({
      body: "אפשר לשלוח בבקשה חשבונית מס?",
      phone: "+972547495083",
      history: [],
    })

    assert.match(reply, /האם\s+העסקה\s+רשומה\s+על\s+המספר/)
    assert.doesNotMatch(reply, /איזה\s+סוג/)
  })

  it("skips branch/courier when customer already said חשבונית מס", async () => {
    const reply = await resolveDigitalDocumentFlowReply({
      body: "אני צריך העתק של חשבונית מס",
      phone: "+972547495083",
      history: [],
    })

    assert.match(reply, /האם\s+העסקה\s+רשומה\s+על\s+המספר/)
    assert.doesNotMatch(reply, /סופקו\s+מהסניף/)
    assert.doesNotMatch(reply, /באמצעות\s+שליח/)
  })

  it("infers invoice vs receipt intent", () => {
    assert.equal(inferDocumentIntent("אפשר לקבל חשבונית?"), "invoice")
    assert.equal(inferDocumentIntent("אפשר לקבל קבלה?"), "receipt")
  })

  it("offers only invoice types when customer asked for חשבונית", async () => {
    const reply = await resolveDigitalDocumentFlowReply({
      body: "אפשר לקבל חשבונית?",
      phone: "+972547495083",
      history: [],
    })

    assert.match(reply, /איזה\s+סוג\s+חשבונית/)
    assert.match(reply, /חשבונית\s+מס/)
    assert.match(reply, /חשבונית\s+מס\s+קבלה/)
    assert.doesNotMatch(reply, /\n3\.\s*קבלה/)
  })

  it("skips type question for receipt-only requests", async () => {
    const reply = await resolveDigitalDocumentFlowReply({
      body: "אפשר לקבל קבלה?",
      phone: "+972547495083",
      history: [],
    })

    assert.match(reply, /האם\s+העסקה\s+רשומה\s+על\s+המספר/)
    assert.doesNotMatch(reply, /סופקו\s+מהסניף/)
  })

  it("after tax invoice selection asks phone confirm — not branch/courier", async () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "אפשר לקבל חשבונית?", agent: null },
      {
        role: "assistant",
        content: buildDocumentTypeQuestion("invoice"),
        agent: "master",
      },
    ]

    const reply = await resolveDigitalDocumentFlowReply({
      body: "חשבונית מס",
      phone: "+972547495083",
      history,
    })

    assert.match(reply, /האם\s+העסקה\s+רשומה\s+על\s+המספר/)
    assert.doesNotMatch(reply, /סופקו\s+מהסניף/)
    assert.doesNotMatch(reply, /לא\s+הבנתי/)
  })

  it("parses document type selections", () => {
    assert.equal(parseDocumentTypeFromText("חשבונית מס"), "חשבונית מס")
    assert.equal(parseDocumentTypeFromText("חשבונית מס קבלה"), "חשבונית מס קבלה")
    assert.equal(parseDocumentTypeFromText("קבלה"), "קבלה")
  })

  it("detects uncertainty on channel question", () => {
    assert.equal(isDocumentChannelUncertaintyAnswer("לא זוכר"), true)
    assert.equal(isDocumentChannelUncertaintyAnswer("לא יודעת"), true)
  })

  it("detects order line-item verification (color ordered)", () => {
    assert.equal(
      isOrderLineItemVerificationRequest("אני רק רוצה לוודא את הצבע שהזמנתי"),
      true
    )
    assert.equal(isOrderLineItemVerificationRequest("איפה המשלוח שלי"), false)
    assert.equal(
      isOrderLineItemVerificationRequest("הצבע לא תואם לאתר"),
      false
    )
  })

  it("maps internet purchase to courier docs path", () => {
    assert.equal(parseDocumentPurchaseChannel("אינטרנט"), "website")
    assert.equal(parseDocumentPurchaseChannel("בסניף"), "store")
  })

  it("uses document phone confirm wording", () => {
    const prompt = buildDocumentPhoneConfirmPrompt("+972547495083")
    assert.match(prompt, /האם\s+העסקה\s+רשומה/)
    assert.doesNotMatch(prompt, /אמצא\s+את\s+ההזמנה/)
  })

  it("continues legacy channel flow when channel already set", async () => {
    const history: HistoryMessage[] = [
      {
        role: "user",
        content: "אני צריך העתק של הקבלה שלי",
        agent: null,
      },
      {
        role: "assistant",
        content: "אין בעיה, האם המוצרים סופקו מהסניף או באמצעות שליח?",
        agent: "master",
      },
      { role: "user", content: "לא זוכר", agent: null },
      {
        role: "assistant",
        content: "אין בעיה — האם ההזמנה בוצעה מהאינטרנט או בסניף?",
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
})
