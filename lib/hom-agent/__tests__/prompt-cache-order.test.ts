import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { buildHomBotPrompt } from "@/lib/hom-agent/hom-bot-prompt"
import {
  buildHomAgentSystemPrompt,
  buildHomAgentSystemPromptAsync,
  buildHomAgentSystemPromptPartsAsync,
  homAgentFinalOutputIndex,
  homAgentKbSectionIndex,
} from "@/lib/hom-agent/prompt"

describe("prompt cache prefix order", () => {
  it("places static FINAL OUTPUT before dynamic KB section", () => {
    const prompt = buildHomAgentSystemPrompt({
      userText: "מתי מגיע המשלוח",
      history: [{ role: "user", content: "מתי מגיע המשלוח" }],
      whatsappPhone: "0501234567",
      sessionSummary: "לקוח שואל על משלוח",
    })

    const finalIdx = homAgentFinalOutputIndex(prompt)
    const kbIdx = homAgentKbSectionIndex(prompt)
    assert.ok(finalIdx >= 0, "FINAL OUTPUT block must exist")
    assert.ok(kbIdx >= 0, "KB section must exist")
    assert.ok(finalIdx < kbIdx, "static contract must precede per-turn KB for cache prefix")
  })

  it("keeps hom-bot playbook before FINAL OUTPUT", () => {
    const prompt = buildHomAgentSystemPrompt({ userText: "שלום" })
    assert.ok(prompt.includes("### FINAL OUTPUT"))
    assert.ok(homAgentFinalOutputIndex(prompt) > 1000, "hom-bot.md should lead the prompt")
  })

  it("keeps the cached static prefix byte-identical across turns; per-turn data stays dynamic", async () => {
    const common = { modelTier: "T3" as const, llmOwnsIntent: true }
    const a = await buildHomAgentSystemPromptPartsAsync({
      ...common,
      userText: "מתי מגיע המשלוח",
      history: [{ role: "user", content: "מתי מגיע המשלוח" }],
      whatsappPhone: "0501234567",
      customerName: "דנה",
      sessionSummary: "לקוח שואל על משלוח",
      now: new Date("2026-10-07T09:15:00Z"),
    })
    const b = await buildHomAgentSystemPromptPartsAsync({
      ...common,
      userText: "יש לכם שטיח עגול",
      history: [{ role: "user", content: "יש לכם שטיח עגול" }],
      whatsappPhone: "0529999999",
      customerName: "יוסי",
      sessionSummary: "לקוח מתעניין במוצר",
      now: new Date("2026-10-07T13:42:00Z"),
    })

    assert.equal(a.staticPrefix, b.staticPrefix)
    assert.ok(a.staticPrefix.endsWith(homAgentFinalOutputTail()))
    for (const perTurn of ["### VERIFIED KNOWLEDGE BASE", "### CHANNEL CONTEXT", "0501234567", "לקוח שואל על משלוח"]) {
      assert.ok(!a.staticPrefix.includes(perTurn), `static prefix must not contain ${perTurn}`)
      assert.ok(a.dynamic.includes(perTurn), `dynamic part must contain ${perTurn}`)
    }

    const joined = await buildHomAgentSystemPromptAsync({
      ...common,
      userText: "מתי מגיע המשלוח",
      history: [{ role: "user", content: "מתי מגיע המשלוח" }],
      whatsappPhone: "0501234567",
      customerName: "דנה",
      sessionSummary: "לקוח שואל על משלוח",
      now: new Date("2026-10-07T09:15:00Z"),
    })
    assert.equal(joined, `${a.staticPrefix}${a.dynamic}`, "model must see the same text as before the split")
  })

  it("shares one cached core across light and full playbook variants", async () => {
    const light = await buildHomAgentSystemPromptPartsAsync({
      modelTier: "T3",
      userText: "שלום",
      history: [{ role: "user", content: "שלום" }],
      llmOwnsIntent: false,
    })
    const full = await buildHomAgentSystemPromptPartsAsync({
      modelTier: "T3",
      userText: "שלום",
      history: [{ role: "user", content: "שלום" }],
      llmOwnsIntent: true,
    })
    assert.equal(light.staticCore, full.staticCore)
    assert.notEqual(light.staticPrefix, full.staticPrefix)
    for (const parts of [light, full]) {
      assert.ok(parts.staticPrefix.startsWith(parts.staticCore))
      assert.ok(parts.staticPrefix.length > parts.staticCore.length)
    }
    assert.doesNotMatch(full.staticCore, /Department boundaries \(owner-locked\)|Must-not-match examples/)
    assert.match(full.staticCore, /Voice & identity/)
  })

  it("light playbook variant does not vary with the customer's words", () => {
    const light = (text: string) =>
      buildHomBotPrompt({ userText: text, history: [{ role: "user", content: text }], llmOwnsIntent: false })
    assert.equal(light("שלום"), light("מה שעות הפתיחה בסניף?"))
  })

  it("every HoM LLM call sends the cached static block, never gateway auto caching", () => {
    const source = readFileSync(join(process.cwd(), "lib/hom-agent/invoke.ts"), "utf8")
      .split("\n")
      .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
      .join("\n")
    assert.doesNotMatch(source, /caching\s*:\s*["']auto["']/)
    assert.match(source, /cacheControl: \{ type: "ephemeral", ttl: "1h" \}/)
    assert.match(source, /content: parts\.staticCore, providerOptions: STATIC_PREFIX_CACHE_OPTIONS/)
    assert.match(
      source,
      /content: parts\.staticPrefix\.slice\(parts\.staticCore\.length\),\s*providerOptions: STATIC_PREFIX_CACHE_OPTIONS/
    )

    const systemArgs = [...source.matchAll(/generateText\(\{\s*model: [^\n]+\n\s*system: ([^\n]+),\n/g)].map(
      (m) => m[1]
    )
    assert.ok(systemArgs.length >= 5, "expected every generateText call to pass system")
    for (const arg of systemArgs) {
      assert.match(
        arg,
        /^(toolSystem|homAgentSystemMessages\()/,
        `system must be the split cached messages, got: ${arg}`
      )
    }
  })
})

function homAgentFinalOutputTail() {
  return "Never leave reply empty on substantive turns."
}
