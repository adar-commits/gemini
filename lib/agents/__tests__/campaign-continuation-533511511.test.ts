import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import {
  formatCampaignLookupReply,
  resolveCampaignLookupValue,
  type CampaignRecord,
} from "@/lib/agents/campaign-lookup"

const CUSTOMER_MESSAGE =
  "המבצע של השטיחים יישאר בתחילת אוקטובר? אני ממש רוצה להזמין שטיח אבל הייתי שמח לחכות ל1.10"

const ACTIVE_RUGS: CampaignRecord = {
  name: "מאות שטיחים ב-65% הנחה",
  start: "2026-09-01",
  end: "2026-09-30",
  status: "active",
  couponCode: null,
  validFor: null,
}

const ACTIVE_POUF: CampaignRecord = {
  name: "1+1 על כל הפופים",
  start: "2026-09-01",
  end: "2026-10-15",
  status: "active",
  couponCode: null,
  validFor: null,
}

describe("campaign continuation question — 533511511", () => {
  it("never quotes the question back as a campaign name", () => {
    const query = resolveCampaignLookupValue(CUSTOMER_MESSAGE, null)
    const reply = formatCampaignLookupReply([ACTIVE_RUGS], query, CUSTOMER_MESSAGE)
    assert.doesNotMatch(reply, /לא מצאתי במערכת מבצע שמתאים/)
    assert.doesNotMatch(reply, /יישאר בתחילת אוקטובר/)
    assert.match(reply, /65%/)
    assert.match(reply, /עד /)
  })

  it("several active campaigns → each one shows its end date", () => {
    const query = resolveCampaignLookupValue(CUSTOMER_MESSAGE, null)
    const reply = formatCampaignLookupReply([ACTIVE_RUGS, ACTIVE_POUF], query, CUSTOMER_MESSAGE)
    assert.doesNotMatch(reply, /יישאר בתחילת אוקטובר/)
    assert.equal(reply.match(/\(עד /g)?.length, 2)
  })

  it("prompt teaches end date, no extension promise, sales advisor offer", () => {
    const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")
    const rule = prompt.split("\n").find((line) => line.includes("(533511511)"))
    assert.ok(rule, "continuation rule missing from hom-bot.md")
    assert.match(rule, /end date/)
    assert.match(rule, /Never promise/)
    assert.match(rule, /sales advisor/)
  })
})
