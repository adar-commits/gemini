import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildInventoryRecheckSkuPrompt,
  isInventoryRecheckRequest,
  resolveBranchInventoryReply,
} from "@/lib/agents/inventory-lookup"
import { buildNoOrdersFoundReply } from "@/lib/agents/order-lookup"
import { runPreTurnGuards } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

describe("pre-turn voice message", () => {
  it("apologizes and asks customer to type instead of sending audio", () => {
    const result = runPreTurnGuards({
      turn: {
        text: "",
        media: [{ kind: "audio", url: "https://example.com/voice.ogg" }],
      },
      history: [],
    })

    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "reply")
    assert.match(result.reply, /הודעות קול|להאזין/)
    assert.match(result.reply, /לכתוב|להקליד/)
    assert.match(result.reply, /מודל AI|AI/)
  })
})

describe("pre-turn human handoff", () => {
  it("does not consume אוקיי confirmations; LLM owns handoff confirmation semantics", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "איפה ההזמנה שלי?" },
      {
        role: "assistant",
        content: buildNoOrdersFoundReply("0521234567"),
      },
    ]

    const result = runPreTurnGuards({
      turn: { text: "אוקיי", media: [] },
      history,
    })

    assert.equal(result.kind, "skip")
  })

  it("does not consume bare אוקיי when handoff is pending", () => {
    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content: "*הום בוט :)*\nהאם להעביר את השיחה לנציג שירות שיבדוק עבורכם?",
      },
    ]

    const result = runPreTurnGuards({
      turn: { text: "אוקיי", media: [] },
      history,
    })

    assert.equal(result.kind, "skip")
  })

  it("does not close conversation on תודה when handoff is pending", () => {
    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nהאם להעביר לנציג שירות שיבדוק עבורכם?",
      },
    ]

    const result = runPreTurnGuards({
      turn: { text: "תודה", media: [] },
      history,
    })

    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "reply")
    assert.match(result.reply, /בשמחה/)
    assert.match(result.reply, /כן/)
    assert.doesNotMatch(result.reply, /העברתי/)
  })

  it("does not treat בסדר תודה as handoff confirm when handoff is pending", () => {
    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nלפני שאני מעביר — האם להעביר את הפנייה לנציג שירות עכשיו?",
      },
    ]

    const result = runPreTurnGuards({
      turn: { text: "בסדר תודה", media: [] },
      history,
    })

    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "reply")
    assert.match(result.reply, /בשמחה/)
    assert.doesNotMatch(result.reply, /העברתי/)
  })

  it("thanks warmly after handoff was already confirmed", () => {
    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content: "מעולה, העברתי את השיחה לנציג שירות. ניצור קשר בהקדם.",
        action: "human_service",
      },
    ]

    const result = runPreTurnGuards({
      turn: { text: "בסדר תודה", media: [] },
      history,
    })

    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "reply")
    assert.match(result.reply, /בשמחה/)
    assert.match(result.reply, /הנציג כבר קיבל/)
    assert.doesNotMatch(result.reply, /עדיין מעבד/)
  })

  it("keeps conversation open on bare תודה without handoff pending", () => {
    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content: "*הום בוט :)*\nבדקתי, ההזמנה בדרך ללקוח.",
      },
    ]

    const result = runPreTurnGuards({
      turn: { text: "תודה רבה", media: [] },
      history,
    })

    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "reply")
    assert.match(result.reply, /במה עוד/)
  })
})

describe("inventory recheck", () => {
  it("detects follow-up stock recheck requests", () => {
    assert.equal(isInventoryRecheckRequest("תבדוק שוב"), true)
    assert.equal(isInventoryRecheckRequest("יש גם בנתניה?"), true)
    assert.equal(isInventoryRecheckRequest("42000057-120170"), false)
  })

  it("asks for a new SKU on recheck without reusing prior SKU", async () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "42000057-120170" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nבדקתי זמינות לדגם 42000057-120170:\n\n*יש במלאי:*\n• נתניה",
      },
    ]

    const reply = await resolveBranchInventoryReply({
      body: "תבדוק עוד דגם",
      history,
    })

    assert.match(reply, /מק״ט/)
    assert.match(buildInventoryRecheckSkuPrompt(), /יועץ מכירות/)
  })
})
