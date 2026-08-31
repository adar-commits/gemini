import type { PostPurchaseCaseKind } from "@/lib/agents/inquiry-intent"

export const DEFECT_FLOW_MARKER = "מצטער על הפגם במוצר"
export const DISSATISFACTION_FLOW_MARKER = "מצטער שלא עמדתי בציפיות"
export const RETURN_FLOW_MARKER = "קיבלתי — רוצה להחזיר"
export const RETURN_PICKUP_PENDING_FLOW_MARKER = "לגבי איסוף להחלפה/החזרה"
export const PREORDER_FLOW_MARKER = "לגבי ההזמנה המוקדמת"
export const MISSING_ITEM_FLOW_MARKER = "לגבי פריט חסר בהזמנה"

export const CASE_MARKERS: Record<PostPurchaseCaseKind, string> = {
  defect: DEFECT_FLOW_MARKER,
  dissatisfaction: DISSATISFACTION_FLOW_MARKER,
  return_request: RETURN_FLOW_MARKER,
  return_pickup_pending: RETURN_PICKUP_PENDING_FLOW_MARKER,
  preorder_delay: PREORDER_FLOW_MARKER,
  missing_item: MISSING_ITEM_FLOW_MARKER,
}

export function caseMarkerForKind(kind: PostPurchaseCaseKind) {
  return CASE_MARKERS[kind]
}

export function flowMarkerFromText(text: string): PostPurchaseCaseKind | null {
  if (text.includes(DEFECT_FLOW_MARKER) || text.includes("מצטערים על הפגם")) {
    return "defect"
  }
  if (
    text.includes(DISSATISFACTION_FLOW_MARKER) ||
    text.includes("מבינים שלא עמדנו בציפיות")
  ) {
    return "dissatisfaction"
  }
  if (text.includes(RETURN_FLOW_MARKER)) return "return_request"
  if (text.includes(RETURN_PICKUP_PENDING_FLOW_MARKER)) return "return_pickup_pending"
  if (text.includes(PREORDER_FLOW_MARKER)) return "preorder_delay"
  if (text.includes(MISSING_ITEM_FLOW_MARKER)) return "missing_item"
  return null
}
