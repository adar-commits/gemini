import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import {
  hasPurchaseConfirmationAfterPayplusOutreach,
  isOpenPayplusHeverUnpaidOutreachThread,
  isPayplusPaidReceiptCallbackChaseFollowUp,
} from "@/lib/agents/payment-intent"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const OUTREACH =
  "היי רונית 👋, אני פונה אליך בהמשך להזמנתך באתר שלנו מס' 77393 הזמנתך אינה עולה על 1000 ש''ח לפיכך באפשרותך לשלם באמצעות הכרטיס הנטען בלבד דרך הקישור הבא: https://payments.payplus.co.il/cfcafb6e-894e-4751-be91-88f45473744e"

const HANDOFF =
  "*הום בוט :)* בטח רונית, מעביר עכשיו לנציג שירות. הוא יחזור אלייך למספר 050-2078306 ויעזור לך להשלים את התשלום על הזמנה 77393 עם הכרטיס הנטען של חבר."

const RECEIPT =
  "שלום רונית מלליס, 👋 תודה על רכישתך בשטיח האדום, להלן קישור לקבלה הדיגיטלית שלך: https://documents.carpetshop.co.il/documents/38dd44c3-88d7-4779-b4d2-4fb007c0d5c6 למעקב אחר התקדמות ההזמנה, יש ללחוץ כאן: https://tracking.carpetshop.co.il/track?orderID=SO26024983"

const CHASE = "עשיתי הזמנה לא ייצרו קשר אפשר לבדוק"

function history534267975(): HistoryMessage[] {
  return [
    { role: "assistant", content: OUTREACH },
    {
      role: "user",
      content: "עשיתי הזמנה לשטיח קיבלתי אישור לא בצעתי תשלום",
    },
    { role: "user", content: "אפשר לחזור אלי בכל מקרה" },
    { role: "assistant", content: HANDOFF },
    { role: "assistant", content: RECEIPT },
  ]
}

/** Replay 534267975 — must not recap stale unpaid payment after receipt template. */
describe("payplus paid receipt callback chase 534267975", () => {
  it("detects PayPlus outreach and later purchase confirmation", () => {
    const history = history534267975()
    assert.equal(isOpenPayplusHeverUnpaidOutreachThread(history), true)
    assert.equal(hasPurchaseConfirmationAfterPayplusOutreach(history), true)
  })

  it("detects no-contact chase after prior handoff", () => {
    assert.equal(
      isPayplusPaidReceiptCallbackChaseFollowUp(history534267975(), CHASE),
      true
    )
  })

  it("hints lookup and forbids stale unpaid recap", () => {
    const hints =
      buildConversationHints({
        history: history534267975(),
        body: CHASE,
      }) ?? ""
    assert.match(hints, /PAYPLUS PAID RECEIPT CALLBACK CHASE \(534267975\)/)
    assert.match(hints, /lookup_order_status/i)
    assert.match(hints, /never.*התשלום עדיין לא הושלם/i)
  })

  it("prompt teaches receipt-after-outreach binding", () => {
    const line = prompt
      .split("\n")
      .find((l) => l.includes("PayPlus receipt after unpaid outreach (534267975)"))
    assert.ok(line)
    assert.match(line!, /lookup_order_status/)
    assert.match(line!, /התשלום עדיין לא הושלם/)
  })
})
