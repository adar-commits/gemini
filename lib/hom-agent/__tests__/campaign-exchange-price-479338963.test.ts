import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, it } from "node:test"
import { isCampaignQuestion } from "@/lib/agents/campaign-lookup"
import { executeGetCampaigns } from "@/lib/hom-agent/tools/campaigns"

const EXCHANGE_PRICE_QUESTION =
  "היות ומחר בבוקר עוד 19 שעות מסתיים המבצע של ה 50 אחוז , סביר להניח שאקבל את השטיח לאחר סיום המבצע. האם במידה וארצה להחליף את הלופס ולקנות את השטיח היקר יותר שטיח גארדה בז מידה 3 על 4 , האם תאשרו לי לקנות אותו ב 50 אחוז הנחה?"

describe("sale price on exchange — 479338963", () => {
  it("dataOnly returns campaign data for the model, never the canned validity reply", async () => {
    assert.equal(isCampaignQuestion(EXCHANGE_PRICE_QUESTION), true)
    const result = await executeGetCampaigns({
      body: EXCHANGE_PRICE_QUESTION,
      campaignHint: "all",
      dataOnly: true,
    })
    if (!result.ok) return
    assert.equal("reply" in result, false)
    assert.ok("campaignsInfo" in result)
    if ("exchangePricePolicy" in result) {
      assert.match(result.exchangePricePolicy, /תקנון המבצע/)
      assert.match(result.exchangePricePolicy, /human_sales/)
    } else {
      assert.fail("exchangePricePolicy missing")
    }
  })

  it("hom-bot.md teaches the exchange-price follow-up instead of a bare validity line", () => {
    const prompt = readFileSync(
      path.join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"),
      "utf8"
    )
    const rule = prompt.split("\n").find((line) => line.includes("479338963"))
    assert.ok(rule, "exchange-price rule missing")
    assert.match(rule, /dataOnly: true/)
    assert.match(rule, /תקנון המבצע/)
    assert.match(rule, /never\*\* "לא הצלחתי להבין"/)
  })
})
