import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import {
  isAwaitingReplyAfterMissingProductChoiceAsk,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const PICK_ASK =
  "*הום בוט :)*\nלפי ההזמנה #77802, אלה הפריטים:\n1. דזרט בז 290*200 DESERT\n2. רומי קרם 190*140 ROMI\n\nאיזה פריט לא הגיע? (מספר או שם)"

/** Replay 533149639 — duplicate human_sales after missing-item line pick. */
describe("partial delivery pick duplicate master 533149639", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "הזמנתי שני שטיחים והגיע לי שטיח אחד" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* היי חן, מצטער לשמוע שהגיע רק שטיח אחד מתוך שניים. כדי שאוכל לאתר את ההזמנה, יש מספר הזמנה?",
    },
    { role: "user", content: "#77802" },
    { role: "assistant", content: PICK_ASK },
  ]

  it("detects awaiting reply after missing-product choice ask", () => {
    assert.equal(isAwaitingReplyAfterMissingProductChoiceAsk(history), true)
  })

  it("binds duplicate master to action end — never human_sales", () => {
    const hints = buildConversationHints({ history, body: "#77802" }) ?? ""
    assert.match(hints, /MISSING ITEM PICK AFTER LOOKUP \(533149639\)/)
    assert.match(hints, /action: end/)
    assert.match(hints, /human_sales/)
    assert.match(hints, /human_service/)
  })

  it("prompt teaches duplicate master on missing-item pick", () => {
    const line = prompt.split("\n").find((l) => l.includes("533149639"))
    assert.ok(line, "missing 533149639 rule")
    assert.match(line!, /action: end/)
    assert.match(line!, /human_sales/)
  })
})
