import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isBranchStoreAvailabilityThanksClose } from "@/lib/agents/inventory-lookup"
import { isThanksAcknowledgment } from "@/lib/agents/conversation-close"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

/** Replay 534200437 — thanks after branch store yes/no must warm-close, not human_sales. */
describe("branch store thanks close 534200437", () => {
  const history: HistoryMessage[] = [
    {
      role: "user",
      content:
        "היי, אשמח לקבל עדכון כשהמידה XL - 200*290 של שטיח ספקטרה קרם-בז'-אפור SPECTRA חוזרת למלאי",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* היי רויטל! מכאן בצ'אט אני לא יכול לרשום התראה… אני מעביר את הבקשה ליועץ מכירות.",
      agent: "sales",
    },
    { role: "user", content: "היי אשמח לדעת מתי יגיע שטיח /אסטרהxl קרם/בז" },
    {
      role: "assistant",
      content: "היי רציתי לעדכן שאין צפי",
    },
    { role: "assistant", content: "אפשר לעניין אותך בדגמים דומים?" },
    { role: "user", content: "אם יש משהו דומה בצבעים ובדגם לספקטרה" },
    {
      role: "assistant",
      content:
        "https://www.carpetshop.co.il/products/boston-04-gray https://www.carpetshop.co.il/products/niva-01-cream-beige",
    },
    { role: "user", content: "יש אותו בחנות בנתניה?" },
    { role: "user", content: "כדי שאוכל לראות" },
    { role: "assistant", content: "כן" },
  ]

  const body = "תודה"

  it("detects branch store availability thanks close from thread state", () => {
    assert.equal(isThanksAcknowledgment(body), true)
    assert.equal(isBranchStoreAvailabilityThanksClose(body, history), true)
  })

  it("hints warm close — never human_sales on thanks after store yes/no", () => {
    const hints = buildConversationHints({ body, history }) ?? ""
    assert.match(hints, /534200437/)
    assert.match(hints, /BRANCH STORE AVAILABILITY THANKS CLOSE/i)
    assert.match(hints, /action: end/i)
    assert.match(hints, /never.*human_sales/i)
    assert.doesNotMatch(hints, /SALES RECAP \+ OPTIONAL PHOTO/)
  })
})
