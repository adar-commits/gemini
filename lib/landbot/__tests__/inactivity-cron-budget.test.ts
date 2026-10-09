import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { runWithinBudget } from "@/lib/landbot/inactivity-cron"

/** The idle cron hit its 60s maxDuration every minute, so due closes never ran (534098184). */
describe("inactivity cron time budget", () => {
  it("processes rows concurrently and finishes all when time allows", async () => {
    const seen: number[] = []
    let inFlight = 0
    let peak = 0
    const left = await runWithinBudget(
      [1, 2, 3, 4, 5, 6, 7, 8],
      Date.now() + 5_000,
      async (row) => {
        inFlight += 1
        peak = Math.max(peak, inFlight)
        await new Promise((resolve) => setTimeout(resolve, 5))
        seen.push(row)
        inFlight -= 1
      },
      3
    )
    assert.equal(left, 0)
    assert.equal(seen.length, 8)
    assert.equal(peak, 3)
  })

  it("stops starting rows after the deadline and reports the rest as deferred", async () => {
    const left = await runWithinBudget([1, 2, 3, 4], Date.now() - 1, async () => {
      throw new Error("must not run")
    })
    assert.equal(left, 4)
  })
})
