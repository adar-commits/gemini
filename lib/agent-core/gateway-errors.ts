const BUDGET_EXCEEDED_RE =
  /budget exceeded|quota_for_entity_exceeded|Team budget exceeded/i

export function isGatewayBudgetExceeded(error: unknown) {
  if (!error) return false
  const message = error instanceof Error ? error.message : String(error)
  if (BUDGET_EXCEEDED_RE.test(message)) return true
  const cause = error instanceof Error ? (error as Error & { cause?: unknown }).cause : null
  if (cause instanceof Error && BUDGET_EXCEEDED_RE.test(cause.message)) return true
  const status = (error as { statusCode?: number }).statusCode
  return status === 402 && BUDGET_EXCEEDED_RE.test(message)
}

export function gatewayErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error)
}
