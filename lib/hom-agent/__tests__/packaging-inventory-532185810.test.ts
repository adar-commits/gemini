import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import {
  isCarpetPackagingOpenQuestion,
  buildCarpetPackagingFaqReply,
} from "@/lib/agents/policy-subjects"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import {
  runStructuredInventoryPreTurn,
  runStructuredKbSelfServiceFaqPreTurn,
} from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

/** Replay 532185810 — packaging KB + inventory SKU binding. */
describe("packaging FAQ and inventory SKU (532185810)", () => {
  const packagingQuestion = "איך פותחים את האריזה כשהשטיח מגיע?"

  it("detects packaging open questions, not return policy", () => {
    assert.equal(isCarpetPackagingOpenQuestion(packagingQuestion), true)
    assert.equal(
      isCarpetPackagingOpenQuestion("האם אפשר להחזיר באריזה המקורית?"),
      false
    )
    assert.equal(isCarpetPackagingOpenQuestion("מה מדיניות החזרה?"), false)
  })

  it("structured KB pre-turn answers packaging from FAQ", () => {
    const result = runStructuredKbSelfServiceFaqPreTurn({
      turn: { text: packagingQuestion, media: [] },
      history: [],
    })
    assert.equal(result.kind, "handled")
    assert.match(result.reply ?? "", /מספריים/)
    assert.match(buildCarpetPackagingFaqReply(), /פלסטיק/)
  })

  it("hints packaging FAQ and inventory SKU binding", () => {
    const stockHistory: HistoryMessage[] = [
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nכדי לבדוק מלאi אני צריך את המק״ט (לדוגמה: 31503138-200290).",
      },
    ]
    const packagingHints = buildConversationHints({
      body: packagingQuestion,
      history: [],
    })
    assert.match(packagingHints ?? "", /CARPET PACKAGING FAQ/i)

    const skuHints = buildConversationHints({
      body: "31503138-200290",
      history: stockHistory,
    })
    assert.match(skuHints ?? "", /INVENTORY SKU PROVIDED/i)
  })

  it("inventory pre-turn handles SKU after stock ask", async () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "יש במלאi בבני ברק?" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nכדי לבדוק מלאi אני צריך את המק״ט (לדוגמה: 31503138-200290).",
      },
    ]

    const skip = await runStructuredInventoryPreTurn({
      turn: { text: packagingQuestion, media: [] },
      history,
    })
    assert.equal(skip.kind, "skip")

    const handled = await runStructuredInventoryPreTurn({
      turn: { text: "31503138-200290", media: [] },
      history,
    })
    assert.equal(handled.kind, "handled")
    assert.match(handled.reply ?? "", /31503138-200290/)
    assert.doesNotMatch(handled.reply ?? "", /שלחו מק״ט/)
  })

  it("hom-bot prompt teaches packaging FAQ and SKU lookup binding", () => {
    const prompt = readFileSync(
      join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"),
      "utf8"
    )
    assert.match(prompt, /Packaging|איך פותחים את האריזה/)
    assert.match(prompt, /lookup_inventory/)
  })
})
