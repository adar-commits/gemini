import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildAfterHoursHandoffPrefix,
  buildHumanHandoffConfirmedReply,
  enrichHandoffReply,
  humanAgentTeamHoursLabel,
  isHumanAgentTeamOnline,
} from "@/lib/agents/human-agent-hours"
import { CUSTOMER_HEADER } from "@/lib/agents/types"

describe("human agent hours", () => {
  it("defaults service hours to Sunday–Thursday 09:00-16:00", () => {
    assert.equal(humanAgentTeamHoursLabel("human_service"), "א'-ה' 09:00-16:00")
  })

  it("defaults sales hours to Sunday–Thursday 09:30-18:00 and Friday 09:00-14:00", () => {
    assert.equal(humanAgentTeamHoursLabel("human_sales"), "א'-ה' 09:30-18:00, ו' 09:00-14:00")
  })

  it("considers service offline before 09:00 Israel time", () => {
    const at0830 = new Date("2026-09-09T05:30:00.000Z") // Wed 08:30 IST
    assert.equal(isHumanAgentTeamOnline("human_service", at0830), false)
  })

  it("considers service online during 09:00-16:00 Israel time", () => {
    const at1000 = new Date("2026-09-09T07:00:00.000Z") // Wed 10:00 IST
    assert.equal(isHumanAgentTeamOnline("human_service", at1000), true)
  })

  it("considers service offline all day Friday and Saturday", () => {
    const friday1000 = new Date("2026-09-11T07:00:00.000Z") // Fri 10:00 IST
    const saturday1000 = new Date("2026-09-12T07:00:00.000Z") // Sat 10:00 IST
    assert.equal(isHumanAgentTeamOnline("human_service", friday1000), false)
    assert.equal(isHumanAgentTeamOnline("human_service", saturday1000), false)
  })

  it("considers service offline from 16:00 Israel time", () => {
    const at1600 = new Date("2026-09-09T13:00:00.000Z") // 16:00 IST
    assert.equal(isHumanAgentTeamOnline("human_service", at1600), false)
  })

  it("considers sales offline before 09:30 Israel time", () => {
    const at0900 = new Date("2026-09-09T06:00:00.000Z") // 09:00 IST
    assert.equal(isHumanAgentTeamOnline("human_sales", at0900), false)
  })

  it("considers sales online during 09:30-18:00 Israel time", () => {
    const at1700 = new Date("2026-09-09T14:00:00.000Z") // 17:00 IST
    assert.equal(isHumanAgentTeamOnline("human_sales", at1700), true)
  })

  it("considers sales offline from 18:00 Israel time", () => {
    const at1900 = new Date("2026-09-09T16:00:00.000Z") // 19:00 IST
    assert.equal(isHumanAgentTeamOnline("human_sales", at1900), false)
  })

  it("uses a single after-hours paragraph without duplicate transfer line", () => {
    const at1900 = new Date("2026-09-09T16:00:00.000Z")
    const reply = buildHumanHandoffConfirmedReply("human_sales", at1900)
    assert.match(reply, /אין יועצי מכירות זמינים/)
    assert.match(reply, /09:30-18:00/)
    assert.match(reply, /קיבלנו את הפנייה/)
    assert.doesNotMatch(reply, /העברתי את השיחה/)
    assert.doesNotMatch(reply, /מעביר את הפרטים/)
  })

  it("keeps standard copy during business hours", () => {
    const at1400 = new Date("2026-09-09T11:00:00.000Z") // 14:00 IST
    const reply = buildHumanHandoffConfirmedReply("human_service", at1400)
    assert.equal(reply, "מעולה, העברתי את השיחה לנציג שירות. ניצור קשר בהקדם.")
    assert.doesNotMatch(reply, /שעות הפעילות/)
  })

  it("keeps the agent's help after hours and closes with one offline notice", () => {
    const at1900 = new Date("2026-09-09T16:00:00.000Z")
    const llm = `${CUSTOMER_HEADER}\nאפשר להחליף למידה גדולה יותר בכל סניף, בתוך 14 יום ובאריזה המקורית.`
    const once = enrichHandoffReply(llm, "human_sales", at1900)
    const twice = enrichHandoffReply(once, "human_sales", at1900)
    assert.ok(once.startsWith(`${CUSTOMER_HEADER}\nאפשר להחליף למידה גדולה יותר`))
    assert.match(once, /אין יועצי מכירות זמינים \(שעות הפעילות א'-ה' 09:30-18:00, ו' 09:00-14:00\)/)
    assert.equal(once.split(CUSTOMER_HEADER).length, 2)
    assert.equal(once, twice)
  })

  it("does not append a second notice to a runtime-built offline reply", () => {
    const at1900 = new Date("2026-09-09T16:00:00.000Z")
    const built = `${CUSTOMER_HEADER}\n${buildHumanHandoffConfirmedReply("human_service", at1900)}`
    assert.equal(enrichHandoffReply(built, "human_service", at1900), built)
  })

  it("fills empty LLM handoff reply after hours", () => {
    const at1900 = new Date("2026-09-09T16:00:00.000Z")
    const reply = enrichHandoffReply("", "human_sales", at1900)
    assert.match(reply, /קיבלנו את הפנייה/)
  })

  it("builds service after-hours prefix with full hours label", () => {
    assert.match(buildAfterHoursHandoffPrefix("human_service", new Date("2026-09-09T16:00:00.000Z")), /א'-ה' 09:00-16:00/)
  })
})
