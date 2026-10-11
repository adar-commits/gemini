import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const BAD_BEDROOM_PIVOT =
  "*הום בוט :)* אוקיי, קיבלתי. מה מידת המיטה או הרהיט העיקרי בחדר?"

/** 534689164 — school purchase + check payment follow-up must not open bedroom intake. */
describe("institutional check payment 534689164", () => {
  const history: HistoryMessage[] = [
    {
      role: "user",
      content:
        "שלום אני רוצה לרכוש בשביל ביהס שטיח. רציתי לשאול איך אני יכולה לרכוש שהתשלום יהיה בצ'ק?",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* שלום הדס! אצלנו אי אפשר לשלם בצ'קים. מה שכן אפשר: העברה בנקאית (בסניפים בלבד), או כרטיס אשראי עד 12 תשלומים ללא ריבית, באתר ובסניפים. כדי שיועץ המכירות יוכל להתאים לך שטיח, לאיזה חלל בבית הספר הוא מיועד? כיתה, ספרייה, מבואה או משהו אחר?",
    },
  ]

  const customerTurn = "גם בסניף אי אפשר לשלם בצק?"

  it("emits institutional check payment hint, not bedroom quiz", () => {
    const hints = buildConversationHints({
      body: customerTurn,
      history,
      whatsappPhone: "+972500000442",
    })
    assert.match(hints ?? "", /534689164/)
    assert.match(hints ?? "", /INSTITUTIONAL CHECK PAYMENT/i)
    assert.match(hints ?? "", /מידת מיטה|never/i)
    assert.doesNotMatch(hints ?? "", /BEDROOM SPACE COMPLETE/i)
  })

  it("prompt binds school check follow-up away from bedroom intake", () => {
    const line = prompt.split("\n").find((l) => l.includes("534689164"))
    assert.ok(line)
    assert.match(line!, /מידת מיטה|חדר שינה/i)
  })

  it("documents wrong bedroom pivot from production", () => {
    assert.match(BAD_BEDROOM_PIVOT, /מידת המיטה/)
  })
})
