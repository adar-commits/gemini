import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isReturnEligibilityQuestion } from "@/lib/agents/inquiry-intent"
import { executeLookupOrderStatus } from "@/lib/hom-agent/tools/order-status"

describe("return eligibility blocks order lookup tool", () => {
  it("refuses lookup_order_status for hypothetical return on Sunday", async () => {
    const delivery =
      "היי מה קורה השטיח הגיע היום ואני לא בבית עד מוצאי שבת"
    const eligibility =
      "במידה וזה לא ימצא חן בעיני נוכל להחזיר בראשון ולקבל את הזיכוי?"
    const history = [{ role: "user" as const, content: delivery }]

    assert.equal(isReturnEligibilityQuestion(eligibility, history), true)

    const result = await executeLookupOrderStatus({
      body: `${delivery}\n${eligibility}`,
      history,
    })
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.match(result.error, /Return eligibility/)
    }
  })
})
