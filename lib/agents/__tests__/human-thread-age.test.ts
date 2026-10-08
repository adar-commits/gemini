import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  classifyHumanThreadAge,
  israelStaffHoursBetween,
} from "@/lib/agents/human-thread-age"

describe("human thread age", () => {
  it("counts only Sun–Thu 09:00–18:00 Israel", () => {
    const thu = new Date("2026-10-08T12:00:00+03:00")
    const sameEvening = new Date("2026-10-08T18:30:00+03:00")
    assert.equal(israelStaffHoursBetween(thu, sameEvening), 6)
  })

  it("skips Friday and Saturday", () => {
    const thu = new Date("2026-10-08T15:00:00+03:00")
    const sunMorning = new Date("2026-10-11T10:00:00+03:00")
    assert.equal(israelStaffHoursBetween(thu, sunMorning), 4)
  })

  it("treats 412809595 as stale (16 staff days later)", () => {
    assert.equal(
      classifyHumanThreadAge("2026-09-22T08:26:32.007Z", new Date("2026-10-08T06:16:27.000Z")),
      "stale"
    )
  })

  it("opens bridge after 4 staff hours the same day", () => {
    assert.equal(
      classifyHumanThreadAge("2026-10-08T07:00:00.000Z", new Date("2026-10-08T13:00:00.000Z")),
      "bridge"
    )
  })

  it("stays fresh under 4 staff hours", () => {
    assert.equal(
      classifyHumanThreadAge("2026-10-08T10:00:00.000Z", new Date("2026-10-08T12:30:00.000Z")),
      "fresh"
    )
  })
})
