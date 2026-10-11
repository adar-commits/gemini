import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const BAD_REPLY =
  "*הום בוט :)* היי הדס, סליחה על הבלבול בהודעה הקודמת. אני מעביר אותך עכשיו ליועץ מכירות שימשיך איתך בהחלפה. מעולה, העברתי את השיחה ליועץ מכירות. ניצור קשר בהקדם."

/** Replay 533875414 — bare היי after delivery/charge service complaint must not human_sales / החלפה recap. */
describe("service delivery reopen 533875414", () => {
  const history: HistoryMessage[] = [
    {
      role: "user",
      content:
        "היי בוקר טוב, הגיוני שהזמנתי שטיח ב 2.10 ולא יצרו איתי קשר עדיין לתיאום הובלה ? אין לי מספר הזמנה אבל החיוב מופיע באשראי",
    },
    { role: "user", content: "?" },
    { role: "user", content: "שלום" },
    {
      role: "user",
      content:
        "שירות בלתי נסבל בבקשה שמישהו יחזור אליי . הכסף ירד מהאשראי ואין תגובה הולמת",
    },
    { role: "user", content: "נציג" },
  ]

  it("hints service handoff — not stale exchange sales", () => {
    const hints = buildConversationHints({ body: "היי", history }) ?? ""
    assert.match(hints, /SERVICE DELIVERY REOPEN \(533875414\)/)
    assert.match(hints, /human_service/)
    assert.match(hints, /Never.*human_sales/)
    assert.match(hints, /not.*older resolved exchange\/החלפה/i)
  })

  it("prompt binds handoff recap to delivery coordination complaint", () => {
    const line = prompt.split("\n").find((l) => l.includes("533875414"))
    assert.ok(line, "missing 533875414 handoff recap rule")
    assert.match(line!, /delivery coordination/i)
  })

  it("bad reply used sales exchange narrative", () => {
    assert.match(BAD_REPLY, /יועץ מכירות/)
    assert.match(BAD_REPLY, /החלפה/)
    assert.doesNotMatch(BAD_REPLY, /human_service/i)
  })
})
