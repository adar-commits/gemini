const BUDGET_EXCEEDED_RE =
  /budget exceeded|quota_for_entity_exceeded|Team budget exceeded|insufficient credits?|insufficient funds|credit balance|out of credits|payment required|billing.*(?:exceeded|limit)|spend.*limit/i

function errorText(error: unknown) {
  if (!error) return ""
  if (error instanceof Error) {
    const nested = (error as Error & { cause?: unknown }).cause
    const causeText = nested instanceof Error ? nested.message : nested ? String(nested) : ""
    return `${error.message}\n${causeText}`.trim()
  }
  return String(error)
}

export function isGatewayBudgetExceeded(error: unknown) {
  if (!error) return false
  const message = errorText(error)
  if (BUDGET_EXCEEDED_RE.test(message)) return true
  const status =
    (error as { statusCode?: number }).statusCode ??
    (error as { status?: number }).status
  return status === 402
}

export function gatewayErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error)
}
