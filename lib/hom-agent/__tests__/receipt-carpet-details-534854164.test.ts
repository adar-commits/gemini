import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const RECEIPT = `שלום נעמה אפלקר, 👋 תודה על רכישתך בשטיח האדום, להלן קישור לקבלה הדיגיטלית שלך: https://documents.carpetshop.co.il/documents/1d599688-8388-4181-8fd2-48515784a1ce למעקב אחר התקדמות ההזמנה, יש ללחוץ כאן: https://tracking.carpetshop.co.il/track?orderID=SO26025599`

const BAD_HANDOFF =
  "אפשר להיכנס לקישור המעקב שנשלח לך, אבל אין לי כאן פירוט אם הוא מציג את פרטי השטיח"

/** 534854164 — post-purchase receipt thread: where is chosen rug / missing receipt line detail. */
describe("receipt carpet details 534854164", () => {
  const history: HistoryMessage[] = [{ role: "assistant", content: RECEIPT }]
  const body =
    "הי. איפה אני רואה את השטיח שבחרתי?\nלא רואה את הפרטים על השטיח בקבלה\nאשמח שתחזרו אליי"

  it("teaches lookup on Weezmo first reply, not document copy", () => {
    assert.match(prompt, /534854164/)
    assert.match(prompt, /lookup_order_status/)
    const hints = buildConversationHints({ body, history }) ?? ""
    assert.match(hints, /534854164/)
    assert.match(hints, /SO26025599/)
    assert.match(hints, /lookup_order_status/i)
    assert.doesNotMatch(hints, /fetch_digital_document only/)
    assert.doesNotMatch(hints, new RegExp(BAD_HANDOFF))
  })
})
