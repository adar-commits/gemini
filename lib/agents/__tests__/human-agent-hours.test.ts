import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildAfterHoursHandoffPrefix,
  buildHumanHandoffConfirmedReply,
  enrichHandoffReply,
  isHumanAgentTeamOnline,
} from "@/lib/agents/human-agent-hours"
import { CUSTOMER_HEADER } from "@/lib/agents/types"

describe("human agent hours", () => {
  it("considers service online before 15:30 Israel time", () => {
    const at1430 = new Date("2026-09-09T11:30:00.000Z") // 14:30 IST
    assert.equal(isHumanAgentTeamOnline("human_service", at1430), true)
  })

  it("considers service offline from 15:30 Israel time", () => {
    const at1600 = new Date("2026-09-09T13:00:00.000Z") // 16:00 IST
    assert.equal(isHumanAgentTeamOnline("human_service", at1600), false)
  })

  it("considers sales online before 18:00 Israel time", () => {
    const at1700 = new Date("2026-09-09T14:00:00.000Z") // 17:00 IST
    assert.equal(isHumanAgentTeamOnline("human_sales", at1700), true)
  })

  it("considers sales offline from 18:00 Israel time", () => {
    const at1900 = new Date("2026-09-09T16:00:00.000Z") // 19:00 IST
    assert.equal(isHumanAgentTeamOnline("human_sales", at1900), false)
  })

  it("adds after-hours prefix before handoff confirmation", () => {
    const at1900 = new Date("2026-09-09T16:00:00.000Z")
    const reply = buildHumanHandoffConfirmedReply("human_sales", at1900)
    assert.match(reply, /אין יועצי מכירות זמינים/)
    assert.match(reply, /18:00/)
    assert.match(reply, /העברתי את השיחה ליועץ מכירות/)
  })

  it("keeps standard copy during business hours", () => {
    const at1400 = new Date("2026-09-09T11:00:00.000Z")
    const reply = buildHumanHandoffConfirmedReply("human_service", at1400)
    assert.equal(reply, "מעולה, העברתי את השיחה לנציג שירות. ניצור קשר בהקדם.")
    assert.doesNotMatch(reply, /שעות הפעילות/)
  })

  it("enriches LLM handoff copy after hours without duplicating", () => {
    const at1900 = new Date("2026-09-09T16:00:00.000Z")
    const raw = `${CUSTOMER_HEADER}\nמעולה, העברתי את השיחה ליועץ מכירות. ניצור קשר בהקדם.`
    const once = enrichHandoffReply(raw, "human_sales", at1900)
    const twice = enrichHandoffReply(once, "human_sales", at1900)
    assert.match(once, /18:00/)
    assert.equal(once, twice)
  })

  it("builds service after-hours prefix with 15:30 label", () => {
    assert.match(buildAfterHoursHandoffPrefix("human_service"), /15:30/)
  })
})
