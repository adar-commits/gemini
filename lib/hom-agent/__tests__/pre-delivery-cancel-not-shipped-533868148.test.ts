import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { isCancelShipmentConfirmPending } from "@/lib/agents/service-intake"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

/** 533868148 — cancel ask → bot asked shipped? → "לא נשלח" → OOO handoff only. */
describe("pre-delivery cancel not shipped 533868148", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "היי מה נשמע?" },
    { role: "user", content: "יש פה מישהו?" },
    {
      role: "assistant",
      content: "*הום בוט :)* היי מיכל, הכול טוב! 😊 כן, אני כאן. במה אפשר לעזור?",
    },
    { role: "user", content: "קניתי אתמול שטיח אפשר לבטל?" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* כן מיכל, אפשר לבטל. יש לך 14 יום מקבלת השטיח… https://returns.carpetshop.co.il/?phone=0506931774 … השטיח כבר הגיע אלייך, או שהוא עוד לא נשלח?",
    },
  ]

  it("detects cancel shipment confirm pending from bot question", () => {
    assert.equal(isCancelShipmentConfirmPending(history), true)
  })

  it("hints pre-delivery cancel execution after not-shipped confirm", () => {
    const hints = buildConversationHints({
      history,
      body: "לא נשלח",
      whatsappPhone: "0506931774",
    })
    assert.notEqual(hints, null)
    assert.match(hints!, /PRE-DELIVERY CANCEL SHIPMENT CONFIRM \(533868148/)
    assert.match(hints!, /464488405/)
    assert.match(hints!, /action human_service/)
    assert.match(hints!, /after-hours/)
  })

  it("prompt teaches cancel shipment confirm follow-up", () => {
    const line = prompt
      .split("\n")
      .find((l) => l.includes("Cancel shipment confirm") && l.includes("533868148"))
    assert.ok(line, "missing cancel shipment confirm rule")
    assert.match(line!, /464488405/)
    assert.match(line!, /action: human_service/)
    assert.match(line!, /after-hours/)
  })

  it("no shipment-confirm hint when cancel was not asked", () => {
    const shippingOnly: HistoryMessage[] = [
      { role: "user", content: "מתי השטיח יגיע?" },
      {
        role: "assistant",
        content: "השטיח כבר הגיע אלייך, או שהוא עוד לא נשלח?",
      },
    ]
    assert.equal(isCancelShipmentConfirmPending(shippingOnly), false)
  })
})
