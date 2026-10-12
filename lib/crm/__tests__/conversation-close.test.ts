import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { crmCloseBlockedByHuman, crmCloseSyncEnabled } from "@/lib/crm/conversation-close"
import { HOM_CRM_BOT_AGENT_CODE } from "@/lib/landbot/api-agent-ids"

describe("crm conversation close", () => {
  it("is enabled by default", () => {
    const previous = process.env.CRM_CLOSE_SYNC
    delete process.env.CRM_CLOSE_SYNC
    assert.equal(crmCloseSyncEnabled(), true)
    process.env.CRM_CLOSE_SYNC = "false"
    assert.equal(crmCloseSyncEnabled(), false)
    if (previous === undefined) delete process.env.CRM_CLOSE_SYNC
    else process.env.CRM_CLOSE_SYNC = previous
  })

  it("never closes a conversation assigned to a rep", () => {
    assert.equal(
      crmCloseBlockedByHuman({ assignedAgentCode: "427234", liveHumanLastOutbound: false }),
      true
    )
  })

  it("never closes when a rep wrote last, even if the CRM assignment was cleared", () => {
    assert.equal(
      crmCloseBlockedByHuman({ assignedAgentCode: null, liveHumanLastOutbound: true }),
      true
    )
  })

  it("still closes bot-only conversations", () => {
    assert.equal(
      crmCloseBlockedByHuman({
        assignedAgentCode: HOM_CRM_BOT_AGENT_CODE,
        liveHumanLastOutbound: false,
      }),
      false
    )
    assert.equal(
      crmCloseBlockedByHuman({ assignedAgentCode: null, liveHumanLastOutbound: false }),
      false
    )
  })
})
