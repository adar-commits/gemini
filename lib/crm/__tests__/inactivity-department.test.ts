import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { crmDepartmentAllowsServiceInactivity } from "@/lib/crm/conversation-department"

describe("crm inactivity department gate", () => {
  it("allows service inactivity for שירות לקוחות and unset department", () => {
    assert.equal(crmDepartmentAllowsServiceInactivity(null), true)
    assert.equal(crmDepartmentAllowsServiceInactivity(""), true)
    assert.equal(crmDepartmentAllowsServiceInactivity("שירות לקוחות"), true)
  })

  it("blocks service inactivity ping for מכירות", () => {
    assert.equal(crmDepartmentAllowsServiceInactivity("מכירות"), false)
  })
})
