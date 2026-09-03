import assert from "node:assert/strict"
import { describe, it, afterEach } from "node:test"
import { invalidateRuntimeConfigCache } from "@/lib/agent-core/runtime-config"

describe("runtime config env priority", () => {
  const saved: Record<string, string | undefined> = {}

  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    invalidateRuntimeConfigCache()
  })

  function stashEnv(key: string) {
    if (!(key in saved)) saved[key] = process.env[key]
  }

  it("uses Supabase profile over global AGENT_MODEL when row is loaded", async () => {
    stashEnv("AGENT_MODEL")
    stashEnv("AGENT_FAQ_MODEL")
    process.env.AGENT_MODEL = "anthropic/claude-opus-4.6"
    delete process.env.AGENT_FAQ_MODEL
    invalidateRuntimeConfigCache()

    const mod = await import("@/lib/agent-core/runtime-config")
    const config = mod.rowToConfig({
      active_profile: "balanced",
      profile_json: {
        faq: { model: "anthropic/claude-sonnet-4.6", temperature: 0.18, maxOutputTokens: 700 },
      },
      routing_mode: "hybrid",
      debounce_ms: 3000,
      history_limit: 18,
      orchestra_mode: "off",
      updated_at: null,
      updated_by: "test",
    })

    assert.equal(config.profile.faq.model, "anthropic/claude-sonnet-4.6")
  })

  it("still honors role-specific AGENT_FAQ_MODEL over Supabase", async () => {
    stashEnv("AGENT_MODEL")
    stashEnv("AGENT_FAQ_MODEL")
    process.env.AGENT_MODEL = "anthropic/claude-opus-4.6"
    process.env.AGENT_FAQ_MODEL = "google/gemini-2.5-flash"
    invalidateRuntimeConfigCache()

    const mod = await import("@/lib/agent-core/runtime-config")
    const config = mod.rowToConfig({
      active_profile: "balanced",
      profile_json: {
        faq: { model: "anthropic/claude-sonnet-4.6", temperature: 0.18, maxOutputTokens: 700 },
      },
      routing_mode: "hybrid",
      debounce_ms: 3000,
      history_limit: 18,
      orchestra_mode: "off",
      updated_at: null,
      updated_by: "test",
    })

    assert.equal(config.profile.faq.model, "google/gemini-2.5-flash")
  })
})
