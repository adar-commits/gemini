import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { crmCloseSyncEnabled } from "@/lib/crm/conversation-close"

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
})
