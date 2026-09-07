import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isCampaignQuestion } from "@/lib/agents/campaign-lookup"

describe("campaigns tool override gate", () => {
  it("greetings and vague messages are not campaign questions", () => {
    assert.equal(isCampaignQuestion("היי אשמח לקבל מענה"), false)
    assert.equal(isCampaignQuestion("היי"), false)
    assert.equal(isCampaignQuestion("כן"), false)
    assert.equal(isCampaignQuestion("למה זה לא הגיע"), false)
  })

  it("real promotion questions are campaign questions", () => {
    assert.equal(isCampaignQuestion("יש מבצע על שטיחים?"), true)
    assert.equal(isCampaignQuestion("המבצע של 1+1 עדיין בתוקף?"), true)
  })
})
