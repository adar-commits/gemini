import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

/** Replay 360217272 — ?? on overdue exchange shipment must not recap stale defect intake. */
describe("exchange shipping wait ping 360217272", () => {
  it("prompt binds handoff recap to exchange shipping delay", () => {
    const line = prompt.split("\n").find((l) => l.includes("Handoff recap freshness"))
    assert.ok(line)
    assert.match(line!, /360217272/)
    assert.match(line!, /exchange\/replacement shipment delay/i)
  })

  it("wait ping hint prioritizes shipping delay over defect summary", () => {
    const history: HistoryMessage[] = [
      {
        role: "user",
        content:
          "השטיח פגום 2/3 דהוי ויש כתם — #76309 [תמונה]",
      },
      {
        role: "assistant",
        content: "*הום בוט :)* מעולה, העברתי את השיחה לנציג שירות.",
      },
      {
        role: "assistant",
        content:
          "אפשר לעקוב בלינק אחרי התקדמות המשלוח https://tracking.carpetshop.co.il/track?orderID=SO26022630",
      },
      {
        role: "user",
        content: "היי, יש אפשרות לבדוק מה קורה עם המשלוח שלי? עברו כמעט שבועיים",
      },
      {
        role: "user",
        content: "בוקר טוב, מה נסגר עם המשלוח? עברו שלושה שבועות",
      },
    ]
    const hints = buildConversationHints({
      body: "??",
      history,
    })
    assert.match(hints ?? "", /360217272/)
    assert.match(hints ?? "", /shipping delay|delayed replacement/i)
    assert.match(hints ?? "", /Never.*defect|פגום/i)
  })
})
