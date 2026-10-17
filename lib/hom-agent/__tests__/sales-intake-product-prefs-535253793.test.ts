import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const BAD_FAQ_ANTI_SLIP =
  "*הום בוט :)* רשמתי, שטיח בצבע אחיד כדי שהשטיח לא יזוז, אנחנו ממליצים על משטח נגד החלקה מתחתיו."

function session535253793History(): HistoryMessage[] {
  return [
    { role: "user", content: "שלום" },
    {
      role: "assistant",
      content: "*הום בוט :)* שלום אליס! 😊 במה אפשר לעזור?",
    },
    {
      role: "user",
      content: "מחפשת שטיח לסלון צריכה עזרה להתאים צבע לספה",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* בשמחה אליס! יועץ המכירות שלנו יעזור לך להתאים צבע לספה, ואני רק אאסוף כמה פרטים כדי שיהיה לו את כל מה שצריך. מה צבע הספה, ומה הגודל שלה בערך (או מידות הסלון)?",
    },
    { role: "user", content: "3מטר שזלונג 1.90" },
    {
      role: "assistant",
      content: "*הום בוט :)* אוקיי, קיבלתי. האם אמור להתאים לבעלי חיים?",
    },
  ]
}

describe("sales intake product prefs 535253793", () => {
  const body = "רוצה שטיח צבע אחיד שלא זז מהרצפה"

  it("hints bind product prefs to sales intake not FAQ pivot", () => {
    const hints = buildConversationHints({
      history: session535253793History(),
      body,
    })
    assert.ok(hints)
    assert.match(hints, /535253793/)
    assert.match(hints, /SALES INTAKE PRODUCT PREFS/i)
    assert.match(hints, /SALES THREAD/i)
    assert.match(hints, /crm_department: sales/i)
    assert.match(hints, /never.*FAQ-only pivot/i)
  })

  it("prompt binds mid-quiz prefs to sales not FAQ-only", () => {
    const line = prompt.split("\n").find((l) => l.includes("535253793"))
    assert.ok(line)
    assert.match(line!, /crm_department: sales/i)
    assert.match(line!, /never.*FAQ/i)
  })

  it("documents wrong FAQ anti-slip monologue mid-intake", () => {
    assert.match(BAD_FAQ_ANTI_SLIP, /משטח נגד החלקה/)
  })
})
