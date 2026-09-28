import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  formatCampaignLookupReply,
  resolveCampaignLookupValue,
  type CampaignRecord,
} from "@/lib/agents/campaign-lookup"
import { executeGetCampaigns } from "@/lib/hom-agent/tools/campaigns"

const CUSTOMER_MESSAGE = "רציתי לדעת אם המבצע תקף גם בחנויות"

const ACTIVE_65: CampaignRecord = {
  name: "מאות שטיחים ב-65% הנחה",
  start: "2026-09-01",
  end: "2099-12-31",
  status: "active",
  couponCode: null,
  validFor: null,
}

const ACTIVE_POUF: CampaignRecord = {
  name: "1+1 על כל הפופים",
  start: "2026-09-01",
  end: "2099-12-31",
  status: "active",
  couponCode: null,
  validFor: null,
}

const EXPIRED_50: CampaignRecord = {
  name: "הכל ב-50% הנחה",
  start: "2026-08-14",
  end: "2026-08-31",
  status: "expired",
  couponCode: null,
  validFor: null,
}

describe("campaign valid in stores — 307194147", () => {
  it("never quotes the customer's question back as a campaign name", () => {
    const query = resolveCampaignLookupValue(CUSTOMER_MESSAGE, null)
    const reply = formatCampaignLookupReply([ACTIVE_65, EXPIRED_50], query, CUSTOMER_MESSAGE)
    assert.doesNotMatch(reply, /לא מצאתי במערכת מבצע שמתאים/)
    assert.doesNotMatch(reply, /תקף גם בחנויות/)
  })

  it("single active campaign → names it and asks if that is the one", () => {
    const reply = formatCampaignLookupReply([ACTIVE_65, EXPIRED_50], "תקף גם בחנויות", CUSTOMER_MESSAGE)
    assert.match(reply, /65%/)
    assert.match(reply, /לזה הכוונה\?/)
    assert.doesNotMatch(reply, /50% הנחה/)
  })

  it("several active campaigns → lists them and asks which one", () => {
    const reply = formatCampaignLookupReply([ACTIVE_65, ACTIVE_POUF, EXPIRED_50], "תקף גם בחנויות", CUSTOMER_MESSAGE)
    assert.match(reply, /65%/)
    assert.match(reply, /1\+1/)
    assert.match(reply, /לאיזה מהם הכוונה\?/)
  })

  it("empty result for the extracted name → no quoted name", () => {
    const reply = formatCampaignLookupReply([], "תקף גם בחנויות", CUSTOMER_MESSAGE)
    assert.doesNotMatch(reply, /תקף גם בחנויות/)
    assert.match(reply, /יועץ מכירות/)
  })

  it("tool result carries the store-validity policy for the model", async () => {
    const result = await executeGetCampaigns({ body: "", campaignHint: "all" })
    if (result.ok) {
      assert.match(result.storeValidity, /branches/)
      assert.match(result.storeValidity, /תקנון המבצע/)
    }
  })
})
