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
  it("defaults service hours to 08:00-16:00", () => {
    assert.equal(humanAgentTeamHoursLabel("human_service"), "08:00-16:00")
  })

  it("defaults sales hours to 09:30-18:00", () => {
    assert.equal(humanAgentTeamHoursLabel("human_sales"), "09:30-18:00")
  })

  it("considers service offline before 08:00 Israel time", () => {
    const at0700 = new Date("2026-09-09T04:00:00.000Z") // 07:00 IST
    assert.equal(isHumanAgentTeamOnline("human_service", at0700), false)
  })

  it("considers service online during 08:00-16:00 Israel time", () => {
    const at1000 = new Date("2026-09-09T07:00:00.000Z") // 10:00 IST
    assert.equal(isHumanAgentTeamOnline("human_service", at1000), true)
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

  it("replaces LLM handoff fluff after hours with one canonical notice", () => {
    const at1900 = new Date("2026-09-09T16:00:00.000Z")
    const llm =
      "מעולה, מעביר את הפרטים ליועץ מכירות שיחזור אליכם עם התאמות מתאימות"
    const once = enrichHandoffReply(llm, "human_sales", at1900)
    const twice = enrichHandoffReply(once, "human_sales", at1900)
    assert.match(once, /09:30-18:00/)
    assert.doesNotMatch(once, /מעביר את הפרטים/)
    assert.doesNotMatch(once, /התאמות מתאימות/)
    assert.equal(once, twice)
  })

  it("fills empty LLM handoff reply after hours", () => {
    const at1900 = new Date("2026-09-09T16:00:00.000Z")
    const reply = enrichHandoffReply("", "human_sales", at1900)
    assert.match(reply, /קיבלנו את הפנייה/)
  })

  it("builds service after-hours prefix with full hours label", () => {
    assert.match(buildAfterHoursHandoffPrefix("human_service"), /08:00-16:00/)
  })
})
