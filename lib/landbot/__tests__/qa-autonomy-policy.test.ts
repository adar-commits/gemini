import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  qaAutoImplementRiskMax,
  qaAutonomyPolicyBlock,
} from "@/lib/landbot/qa-autonomy-policy"

describe("qa autonomy policy", () => {
  it("defaults auto-implement ceiling to 9", () => {
    delete process.env.QA_AUTOMATION_AUTO_IMPLEMENT_RISK_MAX
    assert.equal(qaAutoImplementRiskMax(), 9)
    assert.match(qaAutonomyPolicyBlock(), /risk_score ≤ 9/)
    assert.match(qaAutonomyPolicyBlock(), /FORBIDDEN.*ask_operator/)
    assert.match(qaAutonomyPolicyBlock(), /critical Hebrew BUSINESS POLICY/)
  })
})
