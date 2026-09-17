import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  crmHomBotAssignDecision,
  shouldClaimCrmHomBotAssignment,
} from "@/lib/crm/conversation-assign"
import { HOM_CRM_BOT_AGENT_CODE } from "@/lib/landbot/api-agent-ids"

describe("crm HomGroup Bot assign (532637652)", () => {
  it("claims an unassigned inbox for HomGroup Bot", () => {
    assert.equal(crmHomBotAssignDecision(null), "claim")
    assert.equal(crmHomBotAssignDecision(""), "claim")
    assert.equal(shouldClaimCrmHomBotAssignment(null), true)
  })

  it("leaves HomGroup Bot assigned", () => {
    assert.equal(crmHomBotAssignDecision(HOM_CRM_BOT_AGENT_CODE), "unchanged")
    assert.equal(shouldClaimCrmHomBotAssignment(HOM_CRM_BOT_AGENT_CODE), false)
  })

  it("does not steal a human assignment", () => {
    assert.equal(crmHomBotAssignDecision("12001"), "human_assigned")
    assert.equal(shouldClaimCrmHomBotAssignment("12001"), false)
  })
})
