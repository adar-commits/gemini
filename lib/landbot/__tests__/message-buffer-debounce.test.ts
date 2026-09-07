import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import {
  debounceWindowMs,
  pickDebounceWindowMs,
} from "@/lib/landbot/message-buffer"

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
    process.env.LANDBOT_DEBOUNCE_MS = "5000"
    delete process.env.LANDBOT_FIRST_TURN_DEBOUNCE_MS

    assert.equal(await debounceWindowMs(), 5000)
  })

  it("defaults to 5000ms for normal messages when env unset", async () => {
    stashEnv("LANDBOT_DEBOUNCE_MS")
    stashEnv("LANDBOT_FIRST_TURN_DEBOUNCE_MS")
    delete process.env.LANDBOT_DEBOUNCE_MS
    delete process.env.LANDBOT_FIRST_TURN_DEBOUNCE_MS

    const window = await debounceWindowMs()
    assert.ok(window >= 5000, `expected >= 5000, got ${window}`)
  })

  it("uses 10000ms opening window even when normal debounce is 5000", () => {
    assert.equal(
      pickDebounceWindowMs({
        extendedOpening: true,
        orderConfirmPending: false,
        normalMs: 5000,
        openingMs: 10000,
      }),
      10000
    )
  })

  it("uses 5000ms after opening phase ends", () => {
    assert.equal(
      pickDebounceWindowMs({
        extendedOpening: false,
        orderConfirmPending: false,
        normalMs: 5000,
        openingMs: 10000,
      }),
      5000
    )
  })

  it("respects LANDBOT_FIRST_TURN_DEBOUNCE_MS override via openingMs", () => {
    assert.equal(
      pickDebounceWindowMs({
        extendedOpening: true,
        orderConfirmPending: false,
        normalMs: 5000,
        openingMs: 12000,
      }),
      12000
    )
  })
})
