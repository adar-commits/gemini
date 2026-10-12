import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import {
  isInstallmentChargeCallbackFollowUp,
  isOpenInstallmentSplitChargeThread,
} from "@/lib/agents/payment-intent"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const PRIOR_HANDOFF =
  "*הום בוט :)* מעולה, העברתי את השיחה לנציג שירות. ניצור קשר בהקדם."

function history534684988(): HistoryMessage[] {
  return [
    {
      role: "user",
      content:
        "עשיתי הזמנה דרך האתר. בחרתי לחלק ל2 תשלומים. אך לא רואה שחייבו בשני תשלומים",
    },
    { role: "assistant", content: PRIOR_HANDOFF },
    { role: "user", content: "תודה רבה" },
  ]
}

/** Replay 534684988 — callback ask after installment handoff must not re-handoff. */
describe("installment charge callback follow-up 534684988", () => {
  it("detects open installment split charge thread", () => {
    assert.equal(isOpenInstallmentSplitChargeThread(history534684988()), true)
  })

  it("detects callback follow-up after prior handoff", () => {
    assert.equal(
      isInstallmentChargeCallbackFollowUp(
        history534684988(),
        "בוקר טוב האם אםשר חחזור אלי"
      ),
      true
    )
  })

  it("callback follow-up hints reply — not duplicate human_service", () => {
    const hints =
      buildConversationHints({
        history: history534684988(),
        body: "בוקר טוב האם אםשר חחזור אלי",
      }) ?? ""
    assert.match(hints, /INSTALLMENT CHARGE CALLBACK FOLLOW-UP \(534684988\)/)
    assert.match(hints, /action: reply/i)
    assert.match(hints, /never.*human_service/i)
    assert.match(hints, /העברתי את השיחה/)
  })

  it("prompt teaches installment callback after handoff", () => {
    const line = prompt
      .split("\n")
      .find((l) => l.includes("Installment charge callback after handoff (534684988)"))
    assert.ok(line)
    assert.match(line!, /action: reply/)
    assert.match(line!, /Never.*human_service/i)
  })
})
