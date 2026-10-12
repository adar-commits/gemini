import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import {
  buildConversationHints,
  isAwaitingReplyAfterWrongItemServiceIntakeAsk,
} from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const SERVICE_ASK =
  "*הום בוט :)*\nהיי טליה, בוקר טוב! סליחה על ההמתנה, אני כאן. כדי שנציג השירות יוכל לטפל בהחלפת הפוף, אני צריך עוד שני פרטים: איזה צבע הזמנת במקור? ומדובר בהזמנת הפופים מ-8.9 (SO26021723)?"

/** Replay 508272038 event window — belated human_sales after FAQ service intake on «היי מה קורה». */
describe("wrong item intake duplicate master 508272038", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "היי מה קורה" },
    { role: "assistant", content: SERVICE_ASK },
  ]

  it("detects awaiting reply after wrong-item service intake", () => {
    assert.equal(isAwaitingReplyAfterWrongItemServiceIntakeAsk(history), true)
  })

  it("binds duplicate master to action end — never human_sales", () => {
    const hints = buildConversationHints({ history, body: "היי מה קורה" }) ?? ""
    assert.match(hints, /WRONG-ITEM SERVICE INTAKE AFTER FAQ \(508272038\)/)
    assert.match(hints, /action: end/)
    assert.match(hints, /human_sales/)
    assert.match(hints, /WRONG ORDER ITEM REPLACEMENT \(508272038\)/)
  })

  it("prompt teaches duplicate master on wrong-item service intake", () => {
    const line = prompt.split("\n").find((l) => l.includes("508272038") && l.includes("duplicate"))
    assert.ok(line, "missing 508272038 duplicate-master rule")
    assert.match(line!, /action: end/)
    assert.match(line!, /human_sales/)
  })
})
