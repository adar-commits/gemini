import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  crmDepartmentForHandoff,
  crmDepartmentSyncEnabled,
} from "@/lib/crm/conversation-department"

describe("crm conversation department", () => {
  it("maps human_sales to מכירות and human_service to שירות לקוחות", () => {
    assert.equal(crmDepartmentForHandoff("human_sales"), "מכירות")
    assert.equal(crmDepartmentForHandoff("human_service"), "שירות לקוחות")
  })

  it("is enabled by default", () => {
    const previous = process.env.CRM_DEPARTMENT_SYNC
    delete process.env.CRM_DEPARTMENT_SYNC
    assert.equal(crmDepartmentSyncEnabled(), true)
    process.env.CRM_DEPARTMENT_SYNC = "false"
    assert.equal(crmDepartmentSyncEnabled(), false)
    if (previous === undefined) delete process.env.CRM_DEPARTMENT_SYNC
    else process.env.CRM_DEPARTMENT_SYNC = previous
  })
})
