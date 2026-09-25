import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildHumanHandoffConfirmedReply,
  enrichHandoffReply,
  isHumanAgentTeamOnline,
} from "@/lib/agents/human-agent-hours"
import { CUSTOMER_HEADER } from "@/lib/agents/types"

const friday0750 = new Date("2026-09-25T04:50:51.000Z")
const friday1000 = new Date("2026-09-25T07:00:00.000Z")
const friday1500 = new Date("2026-09-25T12:00:00.000Z")
const saturday1100 = new Date("2026-09-26T08:00:00.000Z")
const thursday1700 = new Date("2026-09-24T14:00:00.000Z")
const thursday1900 = new Date("2026-09-24T16:00:00.000Z")

/** 532711282 — Friday 07:50 sales handoff said "09:30-18:00" as if the team works the same hours every day. */
describe("weekend rep hours 532711282", () => {
  it("sales works Friday 09:00-14:00 and is closed Saturday", () => {
    assert.equal(isHumanAgentTeamOnline("human_sales", friday0750), false)
    assert.equal(isHumanAgentTeamOnline("human_sales", friday1000), true)
    assert.equal(isHumanAgentTeamOnline("human_sales", friday1500), false)
    assert.equal(isHumanAgentTeamOnline("human_sales", saturday1100), false)
  })

  it("Friday before opening shows the Friday hours, not a single daily range", () => {
    const reply = enrichHandoffReply(
      `${CUSTOMER_HEADER}\nאפשר להחליף למידה גדולה יותר בכל אחד מסניפי הרשת.`,
      "human_sales",
      friday0750
    )
    assert.match(reply, /שעות הפעילות א'-ה' 09:30-18:00, ו' 09:00-14:00/)
    assert.doesNotMatch(reply, /\(שעות הפעילות 09:30-18:00\)/)
  })

  it("sales after Friday close and on Saturday says the team returns Sunday", () => {
    for (const now of [friday1500, saturday1100]) {
      const reply = buildHumanHandoffConfirmedReply("human_sales", now)
      assert.match(reply, /הצוות חוזר ביום ראשון מ-09:30, ניצור איתכם קשר/)
      assert.doesNotMatch(reply, /שעות הפעילות/)
    }
  })

  it("service is closed all Friday and says the team returns Sunday", () => {
    for (const now of [friday0750, friday1000, saturday1100, thursday1700]) {
      const reply = buildHumanHandoffConfirmedReply("human_service", now)
      assert.match(reply, /אין נציגי שירות זמינים/)
      assert.match(reply, /הצוות חוזר ביום ראשון מ-09:00/)
    }
  })

  it("sales on Thursday evening still points to Friday hours", () => {
    const reply = buildHumanHandoffConfirmedReply("human_sales", thursday1900)
    assert.match(reply, /ו' 09:00-14:00/)
    assert.doesNotMatch(reply, /ביום ראשון/)
  })
})
