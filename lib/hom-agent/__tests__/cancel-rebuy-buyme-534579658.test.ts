import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import {
  isPreDeliveryCancelHandoffResponseWaitFollowUp,
  isPreDeliveryCancelServiceHandoffAwaitingCallback,
} from "@/lib/agents/post-handoff"
import { isOrderCancellationSummaryLabel } from "@/lib/agents/service-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const RECEIPT = `שלום דורית, 👋
תודה על רכישתך בשטיח האדום
https://documents.carpetshop.co.il/documents/example
https://tracking.carpetshop.co.il/track?orderID=SO26025296`

/** 534579658 — cancel + rebuy BUYME; FAQ answered אריזה + שמחתי לעזור without portal. */
describe("cancel rebuy buyme 534579658", () => {
  const opening =
    "אני רוצה לבטל את העסקה ולבצע עסקה מחדש עם ביימי"
  const history: HistoryMessage[] = [
    { role: "assistant", content: RECEIPT },
    { role: "user", content: "אני רוצה לבטל את העסקה" },
    { role: "user", content: "ולבצע עסקה מחדש עם ביימי" },
  ]

  it("detects cancel wording with עסקה", () => {
    assert.equal(isOrderCancellationSummaryLabel("אני רוצה לבטל את העסקה"), true)
    assert.equal(isOrderCancellationSummaryLabel(opening), true)
  })

  it("prompt teaches cancel + BUYME rebuy, not status-only warm-close", () => {
    const line = prompt.split("\n").find((l) => l.includes("Cancel + rebuy with BUYME (534579658)"))
    assert.ok(line, "missing cancel rebuy BUYME rule")
    assert.match(line!, /464488405/)
    assert.match(line!, /Never.*lookup_order_status/i)
    assert.match(line!, /שמחתי לעזור/)
  })

  it("hints pre-delivery cancel on opening turn", () => {
    const hints = buildConversationHints({
      history,
      body: opening,
      whatsappPhone: "0528907350",
    })
    assert.notEqual(hints, null)
    assert.match(hints!, /534579658/)
    assert.match(hints!, /action human_service/)
    assert.match(hints!, /Never lookup only/)
  })

  it("order-status tool guards warm-close lookup on pre-delivery cancel", () => {
    const src = readFileSync(
      join(process.cwd(), "lib/hom-agent/tools/order-status.ts"),
      "utf8"
    )
    assert.match(src, /534579658/)
    assert.match(src, /isPreDeliveryCancelWithoutPortalYet/)
    assert.match(src, /isResolvedStatusCloseReply/)
    assert.match(src, /שמחתי לעזור/)
  })
})

const OOO_CANCEL_BUYME_HANDOFF =
  "*הום בוט :)* דורית, סליחה על ההמתנה, אני כאן. הבקשה שלך מסומנת אצל צוות השירות: לבטל את ההזמנה לפני שהיא יוצאת מהמחסן, ולבצע הזמנה חדשה בתשלום עם BUYME. כרגע אין נציגי שירות זמינים (שעות הפעילות א'-ה' 09:00-16:00), אבל אל דאגה — קיבלנו את הפנייה וניצור איתכם קשר מיד עם חזרת הצוות לזמינות."

function historyBeforeNoResponseChase(): HistoryMessage[] {
  return [
    { role: "user", content: "אני רוצה לבטל את העסקה ולבצע עסקה מחדש עם ביימי" },
    { role: "assistant", content: OOO_CANCEL_BUYME_HANDOFF },
    { role: "user", content: "אני זמינה" },
    { role: "user", content: "??" },
    { role: "user", content: "בוקר טוב" },
    { role: "user", content: "שלום" },
    { role: "user", content: "למה לא עונים לי" },
    { role: "user", content: "??" },
  ]
}

/** Replay 534579658 — OOO cancel+BUYME handoff + no-response chase must not duplicate human_service. */
describe("pre-delivery cancel handoff wait 534579658", () => {
  it("detects pre-delivery cancel service handoff awaiting callback", () => {
    assert.equal(
      isPreDeliveryCancelServiceHandoffAwaitingCallback(historyBeforeNoResponseChase()),
      true
    )
  })

  it("detects no-response chase after cancel+BUYME handoff", () => {
    assert.equal(
      isPreDeliveryCancelHandoffResponseWaitFollowUp(
        historyBeforeNoResponseChase(),
        "‏למה אף אחד לא עונה"
      ),
      true
    )
  })

  it("hints reply on no-response chase — not duplicate human_service", () => {
    const hints =
      buildConversationHints({
        history: historyBeforeNoResponseChase(),
        body: "‏למה אף אחד לא עונה",
      }) ?? ""
    assert.match(hints, /534579658/)
    assert.match(hints, /action: reply/i)
    assert.match(hints, /never.*human_service/i)
  })
})
