export function isAuthorized(request: Request) {
  const expected = process.env.AGENT_API_KEY
  if (!expected?.trim()) return true

  const headerKey =
    request.headers.get("x-api-key") ??
    request.headers.get("authorization")
      ?.replace(/^Bearer\s+/i, "")
      .replace(/^Token\s+/i, "")

  return headerKey === expected
}
