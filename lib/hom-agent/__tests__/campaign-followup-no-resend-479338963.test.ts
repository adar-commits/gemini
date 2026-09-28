import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { formatCampaignLookupReply, type CampaignRecord } from "@/lib/agents/campaign-lookup"
import { buildCampaignToolResult } from "@/lib/hom-agent/tools/campaigns"
import type { HistoryMessage } from "@/lib/agents/types"

const CAMPAIGN: CampaignRecord = {
  name: "ראש השנה+ סוכות הכל ב-50%",
  start: "2026-09-01",
  end: "2099-10-04",
  status: "active",
  couponCode: null,
  validFor: null,
}

const EXCHANGE_QUESTION =
  "האם במידה וארצה להחליף את הלופס ולקנות את השטיח היקר יותר שטיח גארדה בז מידה 3 על 4 , האם תאשרו לי לקנות אותו ב 50 אחוז הנחה?"
const FOLLOW_UP = "או קיי אז המבצע לא מסתיים עוד 19 שעות?"

const cannedReply = formatCampaignLookupReply([CAMPAIGN], "50%", EXCHANGE_QUESTION)

describe("campaign follow-up does not re-send the canned answer (479338963)", () => {
  it("follow-up after the canned answer was sent returns data for the model, not the same reply", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: EXCHANGE_QUESTION },
      { role: "assistant", content: cannedReply.replace(" 🙏", "") },
    ]
    const result = buildCampaignToolResult(cannedReply, { body: FOLLOW_UP, history })
    assert.equal("reply" in result, false)
    assert.ok("campaignsInfo" in result)
    if ("note" in result) assert.match(result.note, /never re-send/)
  })

  it("first plain validity question still gets the canned reply", () => {
    const result = buildCampaignToolResult(cannedReply, {
      body: "המבצע של 50% עדיין תקף?",
      history: [],
    })
    assert.ok("reply" in result)
  })
})
