/** Vercel Cron sends Authorization: Bearer $CRON_SECRET — env must be named CRON_SECRET exactly. */
export function resolveCronSecret() {
  return (
    process.env.CRON_SECRET?.trim() ||
    process.env.CRON_SECREET?.trim() ||
    null
  )
}

export function isCronAuthorized(request: Request) {
  const secret = resolveCronSecret()
  if (!secret) return false
  const header = request.headers.get("authorization") ?? ""
  return header === `Bearer ${secret}`
}

export function cronSecretStatus() {
  const canonical = Boolean(process.env.CRON_SECRET?.trim())
  const typoAlias = Boolean(process.env.CRON_SECREET?.trim())
  return {
    configured: canonical || typoAlias,
    canonical_name: canonical,
    typo_alias_only: !canonical && typoAlias,
    vercel_requires: "CRON_SECRET",
  }
}
