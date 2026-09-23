import { CUSTOMER_HEADER } from "@/lib/agents/types"
import type { HistoryMessage } from "@/lib/agents/types"
import { summarizeTurn, turnHasVoiceMessage, type UserTurn } from "@/lib/agents/user-turn"
import {
  isPostPurchaseAlternateSizeThread,
  isShippingAddressChangeAsk,
} from "@/lib/agents/post-purchase-alt-size"
import {
  shouldAckSalesRoomPhotoWithoutVision,
  turnHasCustomerImage,
} from "@/lib/agents/sales-intake"
import type { AgentId } from "@/lib/agents/types"

/** Customer sent image(s) — vision not available; always ack + continue. */
export function shouldAckCustomerImageWithoutVision(input: {
  turn: UserTurn
  history: HistoryMessage[]
  lastAgent?: AgentId | null
}) {
  if (turnHasVoiceMessage(input.turn)) return false
  if (!turnHasCustomerImage(input.turn)) return false
  if (
    shouldAckSalesRoomPhotoWithoutVision(
      input.history,
      input.turn,
      input.lastAgent ?? null
    )
  ) {
    return false
  }
  if (isPostPurchaseAlternateSizeThread(input.history, summarizeTurn(input.turn))) {
    return false
  }
  return true
}

export function buildCustomerImageAckReply(body: string) {
  const caption = body.replace(/\[media:image:[^\]]+\]/gi, "").trim()
  const hasQuestion = /\?/.test(caption) || caption.split(/\s+/).filter(Boolean).length >= 4

  if (hasQuestion) {
    return `${CUSTOMER_HEADER}
קיבלתי את התמונה, תודה 🙏
${caption ? "רשמתי גם את ההודעה שלכם." : "איך אפשר לעזור לגבי מה ששלחתם?"}
אם תרצו — אפשר גם להעביר לנציג שירות שימשיך מכאן.`
  }

  return `${CUSTOMER_HEADER}
קיבלתי את התמונה, תודה 🙏
איך אפשר לעזור — מידות, דגם, או בעיה עם הזמנה?
אם נוח יותר, אפשר להעביר לנציג שירות שימשיך מכאן.`
}

export function inferImageAckHandoffAction(
  body: string,
  history: HistoryMessage[] = []
): "human_sales" | "human_service" {
  if (isShippingAddressChangeAsk(body, history)) return "human_service"
  if (/(?:פגום|פגם|קרוע|בעיה|החזר|ביטול|החלפ)/i.test(body)) return "human_service"
  if (/(?:מחפש|מידות|דגם|לקנות|מכירות|שטיח)/i.test(body)) return "human_sales"
  return "human_service"
}
