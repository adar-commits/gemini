import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const ISSUE_OR_OTHER_ASK =
  "*הום בוט :)* שלום! מדובר בשטיח המדליון שלא הגיע בהזמנה SO26023036, או שיש משהו אחר שאפשר לעזור בו?"

/** Replay 503283917 — כן after issue-or-other ask must not handoff. */
describe("issue or other topic 503283917", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "שלום" },
    { role: "assistant", content: ISSUE_OR_OTHER_ASK },
    {
      role: "user",
      content: "אשמח להבין מה הסטטוס של שטיח מדליון שהזמנתי",
    },
  ]

  it("hints lookup and blocks mistaken human_service on כן", () => {
    const hints = buildConversationHints({ body: "כן", history }) ?? ""
    assert.match(hints, /ORDER OR OTHER TOPIC YES \(532326366 \/ 503283917\)/)
    assert.match(hints, /SO26023036|already named/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /NEVER human_service/)
  })

  it("prompt teaches issue-or-other clarify without handoff", () => {
    const line = prompt.split("\n").find((l) => l.includes("503283917"))
    assert.ok(line, "missing 503283917 issue-or-other rule")
    assert.match(line!, /משהו אחר/)
    assert.match(line!, /lookup_order_status/)
    assert.match(line!, /human_service/)
  })
})
