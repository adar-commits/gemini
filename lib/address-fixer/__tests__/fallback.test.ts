import assert from "node:assert/strict"
import { beforeEach, describe, it } from "node:test"
import { fixAddressWithIndex, type AddressFixerInput } from "@/lib/address-fixer"
import {
  clearFallbackCache,
  withAddressFallback,
  type FallbackDeps,
  type GeocodeHit,
} from "@/lib/address-fixer/fallback"
import { getSnapshotIndex } from "@/lib/address-fixer/street-index"

const index = getSnapshotIndex()

function hit(city: string, street: string, streetNumber = ""): GeocodeHit {
  return { city, street, streetNumber, formatted: `${street} ${streetNumber}, ${city}`, partialMatch: false }
}

async function run(input: AddressFixerInput, deps: Partial<FallbackDeps>) {
  const primary = fixAddressWithIndex(input, index)
  const result = await withAddressFallback(input, primary, index, {
    geocode: deps.geocode ?? (async () => []),
    pick:
      deps.pick ??
      (async () => {
        throw new Error("model down")
      }),
  })
  return { primary, result }
}

describe("address fixer fallback (Google + Haiku)", () => {
  beforeEach(() => clearFallbackCache())

  it("does not run for addresses the matcher already resolved", async () => {
    let called = false
    const { result } = await run(
      { city: "חיפה", full_street: "הרצל 5" },
      {
        geocode: async () => {
          called = true
          return []
        },
      }
    )
    assert.equal(called, false)
    assert.equal(result.match_tier, "city_exact+street_exact")
  })

  it("accepts a Haiku pick of a gov candidate and keeps the customer's numbers", async () => {
    const input = { city: "חולון", full_street: "השר משה שפירא 17", apartment_floor: "קומה 3 דירה 9" }
    const { primary, result } = await run(input, {
      geocode: async () => [hit("חולון", "משה שפירא", "17")],
      pick: async (prompt, ids) => {
        const line = prompt.split("\n").find((row) => row.includes("שפירא חיים משה"))
        return line?.split(":")[0] ?? ids[0]
      },
    })
    assert.equal(primary.street_matched, false)
    assert.equal(result.street, "שפירא חיים משה")
    assert.equal(result.street_matched, true)
    assert.equal(result.street_no, "17")
    assert.deepEqual([result.floor, result.apartment], ["3", "9"])
    assert.match(result.match_tier, /^fallback_/)
  })

  it("respects an explicit 'none' even when Google returned something", async () => {
    const input = { city: "ירושלים", full_street: 'רמב"ם 5' }
    const { primary, result } = await run(input, {
      geocode: async () => [hit("ירושלים", 'רמב"ן', "5")],
      pick: async () => "none",
    })
    assert.equal(result.street, primary.street)
    assert.equal(result.street_matched, false)
    assert.ok(result.notes.includes("fallback_no_confident_match"))
  })

  it("never moves the address to a different city the customer did not write", async () => {
    const input = { city: "חולון", full_street: "השר משה שפירא 17" }
    const { result } = await run(input, {
      geocode: async () => [hit("בת ים", "בלפור", "17")],
      pick: async (_prompt, ids) => ids[0],
    })
    assert.notEqual(result.city, "בת ים")
    assert.equal(result.city, "חולון")
  })

  it("uses a strong, number-consistent Google hit when the model is down", async () => {
    const input = { city: "Tel aviv", full_street: "Israel Bak 11" }
    const { primary, result } = await run(input, {
      geocode: async () => [hit("תל אביב-יפו", 'ב"ק ישראל', "11")],
    })
    assert.equal(primary.street_matched, false)
    assert.equal(result.street, 'ב"ק ישראל')
    assert.equal(result.match_tier, "fallback_google")
    assert.equal(result.street_no, "11")
  })

  it("ignores a Google hit whose house number disagrees when the model is down", async () => {
    const input = { city: "חולון", full_street: "השר משה שפירא 17" }
    const { result } = await run(input, {
      geocode: async () => [hit("חולון", "שפירא חיים משה", "99")],
    })
    assert.equal(result.street_matched, false)
  })

  it("returns the primary result when Google and the model both fail", async () => {
    const input = { city: "חולון", full_street: "השר משה שפירא 17" }
    const { primary, result } = await run(input, {
      geocode: async () => {
        throw new Error("network")
      },
    })
    assert.equal(result.street, primary.street)
    assert.equal(result.street_no, "17")
  })

  it("skips inputs with no street text to look up", async () => {
    let called = false
    await run(
      { city: "תבור", full_street: "4 38" },
      {
        geocode: async () => {
          called = true
          return []
        },
      }
    )
    assert.equal(called, false)
  })
})
