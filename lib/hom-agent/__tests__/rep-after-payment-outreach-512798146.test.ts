import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

/** Replay 512798146 — rep request after PayPlus/Hever payment outreach must not recap old stock alert only. */
describe("rep request after payment outreach 512798146", () => {
  it("prompt binds handoff recap to latest thread context", () => {
    const line = prompt.split("\n").find((l) => l.includes("Handoff recap freshness"))
    assert.ok(line)
    assert.match(line!, /512798146/)
    assert.match(line!, /payment/i)
    assert.match(line!, /back-in-stock/i)
  })

  it("explicit rep hint prioritizes payment outreach over stale sales intake", () => {
    const history: HistoryMessage[] = [
      {
        role: "user",
        content: "היי, אשמח לקבל עדכון כשהמידה L - 160*230 של שטיח נועה קרם NOA חוזרת למלאי",
      },
      {
        role: "assistant",
        content:
          "*הום בוט :)* היי גל! רשמתי את הבקשה: שטיח נועה קרם NOA במידה L ‏160*230.",
      },
      {
        role: "assistant",
        content:
          "הזמנתך באתר נוצרה בהצלחה, אך טרם שולמה. לינק לתשלום מפוצל בין חבר לכרטיס רגיל: https://payments.payplus.co.il/0738a7d8-2517-4300-a253-102d2287ae16",
      },
    ]
    const hints = buildConversationHints({
      body: "אני צריכה לשוחח עם נציג",
      history,
    })
    assert.match(hints ?? "", /512798146/)
    assert.match(hints ?? "", /payment\/order thread/i)
    assert.match(hints ?? "", /not.*back-in-stock alert/i)
    assert.match(hints ?? "", /human_sales or human_service/i)
  })
})
