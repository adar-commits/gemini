import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import { shouldOfferReturnOptionsFirst } from "@/lib/agents/dissatisfaction"
import { runStructuredReturnOptionsPreTurn } from "@/lib/hom-agent/pre-turn"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const BAD_RETURN_MENU =
  "*הום בוט :)* קיבלנו, יש שתי אפשרויות: 1. *החלפה* — ניתן להחליף לשטיח אחר שיתאים יותר"

/** 534665892 — sales intake sofa-size answer must not trigger return/exchange rescue menu. */
describe("sales intake fit sizing 534665892", () => {
  const history: HistoryMessage[] = [
    {
      role: "user",
      content: "היי אשמח לפרטים נוספים לגבי שטיח ולריה קרם-ירוק VALERIA",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* היי שלומי! 😊 בשמחה, אשמח לעזור לך עם שטיח ולריה קרם-ירוק. כדי שנתאים לך את הפרטים הנכונים, לאיזה חדר השטיח מיועד? (סלון, חדר שינה, חדר ילדים או חדר אחר)",
    },
    { role: "user", content: "סלון בעלי חיים כלב,וחתול" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* אוקיי, קיבלתי. מה מידת הספה או הגודל הכללי של הסלון?",
    },
  ]

  const customerTurn =
    "מידות הסלון הן בערך 3.6×3.3 מטר. יש לי ספה פינתית בצורת ר׳, אבל אין לי כרגע את המידות המדויקות שלה. שולחן הסלון הוא 120×67 ס״מ. אני בודק שטיח בגודל 160×230 ס״מ ורוצה לוודא שהוא יתאים לחלל בלי להעמיס עליו."

  it("does not offer return options during active sales intake", () => {
    assert.equal(shouldOfferReturnOptionsFirst(customerTurn, history), false)
  })

  it("pre-turn skips dissatisfaction rescue during sales intake", () => {
    const result = runStructuredReturnOptionsPreTurn({
      turn: { text: customerTurn, media: [] },
      history,
      phone: "+972508536639",
    })
    assert.equal(result.kind, "skip")
  })

  it("hints stay on sales thread without return menu", () => {
    const hints = buildConversationHints({
      body: customerTurn,
      history,
      whatsappPhone: "+972508536639",
    })
    assert.match(hints ?? "", /534665892/)
    assert.match(hints ?? "", /SALES THREAD/i)
    assert.doesNotMatch(hints ?? "", /RETURN OPTIONS FIRST/i)
  })

  it("prompt binds fit check mid-intake to sales not returns portal", () => {
    const line = prompt.split("\n").find((l) => l.includes("534665892"))
    assert.ok(line)
    assert.match(line!, /never.*החלפה|never.*returns portal/i)
  })

  it("documents wrong return menu pivot", () => {
    assert.match(BAD_RETURN_MENU, /יש שתי אפשרויות/)
    assert.match(BAD_RETURN_MENU, /החלפה/)
  })
})
