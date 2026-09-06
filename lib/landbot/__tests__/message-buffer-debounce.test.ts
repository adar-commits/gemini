import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import { debounceWindowMs } from "@/lib/landbot/message-buffer"

describe("debounceWindowMs wiring", () => {
  const saved: Record<string, string | undefined> = {}

  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  function stashEnv(key: string) {
    if (!(key in saved)) saved[key] = process.env[key]
  }

  it("uses LANDBOT_DEBOUNCE_MS for normal window", async () => {
    stashEnv("LANDBOT_DEBOUNCE_MS")
    stashEnv("LANDBOT_FIRST_TURN_DEBOUNCE_MS")
    process.env.LANDBOT_DEBOUNCE_MS = "3000"
    delete process.env.LANDBOT_FIRST_TURN_DEBOUNCE_MS

    assert.equal(await debounceWindowMs(), 3000)
  })

  it("defaults to 3000ms when env unset and runtime unavailable", async () => {
    stashEnv("LANDBOT_DEBOUNCE_MS")
    stashEnv("LANDBOT_FIRST_TURN_DEBOUNCE_MS")
    delete process.env.LANDBOT_DEBOUNCE_MS
    delete process.env.LANDBOT_FIRST_TURN_DEBOUNCE_MS

    const window = await debounceWindowMs()
    assert.ok(window >= 3000, `expected >= 3000, got ${window}`)
  })
})
