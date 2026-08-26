import type { PostPurchaseCaseKind } from "@/lib/agents/inquiry-intent"

export const DEFECT_FLOW_MARKER = "מצטערים על הפגם במוצר"
export const DISSATISFACTION_FLOW_MARKER = "מבינים שלא עמדנו בציפיות"
export const RETURN_FLOW_MARKER = "קיבלתי — רוצה להחזיר"
export const PREORDER_FLOW_MARKER = "לגבי ההזמנה המוקדמת"

export const CASE_MARKERS: Record<PostPurchaseCaseKind, string> = {
  defect: DEFECT_FLOW_MARKER,
  dissatisfaction: DISSATISFACTION_FLOW_MARKER,
  return_request: RETURN_FLOW_MARKER,
  preorder_delay: PREORDER_FLOW_MARKER,
}

export function caseMarkerForKind(kind: PostPurchaseCaseKind) {
  return CASE_MARKERS[kind]
}

export function flowMarkerFromText(text: string): PostPurchaseCaseKind | null {
  if (text.includes(DEFECT_FLOW_MARKER)) return "defect"
  if (text.includes(DISSATISFACTION_FLOW_MARKER)) return "dissatisfaction"
  if (text.includes(RETURN_FLOW_MARKER)) return "return_request"
  if (text.includes(PREORDER_FLOW_MARKER)) return "preorder_delay"
  return null
}
