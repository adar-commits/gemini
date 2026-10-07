import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import { clearOrdersLookupCache, rememberOrdersLookup } from "@/lib/agents/order-lookup-cache"
import type { OrderShipmentStatus } from "@/lib/agents/order-lookup"
import type { HistoryMessage } from "@/lib/agents/types"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runStructuredOrderLookupPreTurn } from "@/lib/hom-agent/pre-turn"

const PHONE = "0545390134"
const BODY =
  "ביצעתי הזמנה וראיתי ב4/10 שהיא כבר יצאה לשילוח. אשמח לדעת מה צפי ההגעה?"

const GREETING: HistoryMessage[] = [
  { role: "user", content: "היי" },
  { role: "assistant", content: "*הום בוט :)*\nהיי Sasha! 😊 במה אפשר לעזור?" },
]

function order(reference: string): OrderShipmentStatus {
  return {
    orderNumber: "SO26024701",
    branchLabel: "אתר אינטרנט",
    statusCode: "4",
    statusLabel: "בדרך",
    statusDescription: "המשלוח אצל חברת השליחויות.",
    branchCode: "3000",
    totalPrice: 890,
    raw: {
      ORDNAME: "SO26024701",
      REFERENCE: reference,
      CURDATE: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    },
  }
}

describe("phone-first lookup 534048082", () => {
  it("searches the chat phone and returns the order card without asking for a number", async () => {
    clearOrdersLookupCache()
    rememberOrdersLookup(PHONE, [order("78220")])
    const result = await runStructuredOrderLookupPreTurn({
      turn: { text: BODY, media: [] },
      history: GREETING,
      phone: PHONE,
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "reply")
    assert.match(result.reply, /78220/)
    assert.match(result.reply, /שבוצעה/)
    assert.doesNotMatch(result.reply, /אפשר לשלוח לי את מספר ההזמנה/)
    assert.doesNotMatch(result.reply, /לפי הטלפון/)
    assert.doesNotMatch(result.reply, /רשומה על/)
  })

  it("asks for an order number only after the phone search finds nothing", async () => {
    clearOrdersLookupCache()
    rememberOrdersLookup(PHONE, [])
    const result = await runStructuredOrderLookupPreTurn({
      turn: { text: BODY, media: [] },
      history: GREETING,
      phone: PHONE,
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.match(result.reply, /לא מצאתי הזמנות פעילות לפי הטלפון/)
    assert.match(result.reply, /מספר ההזמנה/)
    assert.doesNotMatch(result.reply, /לכתוב ["״]לפי הטלפון/)
    assert.doesNotMatch(result.reply, /רשומה על/)
  })

  it("after a miss and no order number, asks if it was registered on that phone, then for another phone", async () => {
    clearOrdersLookupCache()
    rememberOrdersLookup(PHONE, [])
    const missed = await runStructuredOrderLookupPreTurn({
      turn: { text: BODY, media: [] },
      history: GREETING,
      phone: PHONE,
    })
    assert.equal(missed.kind, "handled")
    if (missed.kind !== "handled") return

    const unknown = await runStructuredOrderLookupPreTurn({
      turn: { text: "לא יודע", media: [] },
      history: [
        ...GREETING,
        { role: "user", content: BODY },
        { role: "assistant", content: missed.reply },
      ],
      phone: PHONE,
    })
    assert.equal(unknown.kind, "handled")
    if (unknown.kind !== "handled") return
    assert.match(unknown.reply, /האם בטוח שההזמנה רשומה על המספר/)
    assert.match(unknown.reply, /054-5390134/)

    const other = await runStructuredOrderLookupPreTurn({
      turn: { text: "לא", media: [] },
      history: [
        ...GREETING,
        { role: "user", content: BODY },
        { role: "assistant", content: missed.reply },
        { role: "user", content: "לא יודע" },
        { role: "assistant", content: unknown.reply },
      ],
      phone: PHONE,
    })
    assert.equal(other.kind, "handled")
    if (other.kind !== "handled") return
    assert.match(other.reply, /מה מספר הטלפון שבוצעה עליו ההזמנה/)

    rememberOrdersLookup("0521234567", [order("78221")])
    const relockup = await runStructuredOrderLookupPreTurn({
      turn: { text: "052-1234567", media: [] },
      history: [
        ...GREETING,
        { role: "user", content: BODY },
        { role: "assistant", content: missed.reply },
        { role: "user", content: "לא יודע" },
        { role: "assistant", content: unknown.reply },
        { role: "user", content: "לא" },
        { role: "assistant", content: other.reply },
      ],
      phone: PHONE,
    })
    assert.equal(relockup.kind, "handled")
    if (relockup.kind !== "handled") return
    assert.match(relockup.reply, /78221/)
    assert.match(relockup.reply, /שבוצעה/)
  })

  it("hints the model to search the chat phone before asking for an order number", () => {
    const hints = buildConversationHints({
      body: BODY,
      history: GREETING,
      whatsappPhone: PHONE,
    })
    assert.match(hints ?? "", /PHONE-FIRST LOOKUP \(534048082\)/)
    assert.match(hints ?? "", /Do NOT ask for מספר הזמנה/)
  })

  it("teaches phone-first lookup in the prompt", () => {
    const prompt = readFileSync("lib/hom-agent/prompts/hom-bot.md", "utf8")
    assert.match(prompt, /534048082/)
    assert.match(prompt, /searches that phone itself/)
    assert.match(prompt, /before the phone has been searched/)
  })
})
