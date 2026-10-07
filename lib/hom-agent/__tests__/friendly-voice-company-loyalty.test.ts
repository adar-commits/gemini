import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildHomBotPromptParts } from "@/lib/hom-agent/hom-bot-prompt"

describe("friendly voice stays on HoM's team", () => {
  const { core, tail } = buildHomBotPromptParts({
    userText: "עבר חודש ולא קיבלתי כלום, זה לא בסדר!",
    history: [{ role: "user", content: "עבר חודש ולא קיבלתי כלום, זה לא בסדר!" }],
    llmOwnsIntent: true,
  })

  it("teaches warm gestures and 1–2 emojis on calm turns, none when upset", () => {
    assert.match(core, /Friendly and warm — every message/)
    assert.match(core, /1–2 emojis/)
    assert.match(core, /Upset customer:\*\* stay warm in words, \*\*no emoji\*\*/)
  })

  it("bans siding against HoM, legal advice, and compensation promises in the cached core", () => {
    assert.match(core, /You are on HoM's team — always/)
    for (const banned of ["lawsuit", "consumer-protection complaint", "chargeback", "never promise compensation"]) {
      assert.ok(core.includes(banned), `core missing ban: ${banned}`)
    }
    assert.match(`${core}${tail}`, /Turn against HoM/)
  })
})
