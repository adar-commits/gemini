import { callPriorityWebhook } from "@/lib/agents/priority-webhook"
import { formatHebrewCustomerDate } from "@/lib/agents/hebrew-date-format"
import { CUSTOMER_HEADER } from "@/lib/agents/types"

export type CampaignRecord = {
  name: string
  start: string | null
  end: string | null
  status: "active" | "expired" | "unknown"
  couponCode: string | null
  validFor: string | null
  raw?: Record<string, unknown>
}

const CAMPAIGN_QUESTION_RE =
  /מבצע|הנח(?:ה|ות)|קופון|campaign|בזק|1\s*\+\s*1|50\s*%|השטיח\s+האדום|pozitive|elite\s*rugs?|תקף|בתוקף|פג(?:ה|)?\s+תוקף|עדיין\s+(?:תקף|פעיל)|מתי\s+(?:נגמר|מסתיים)/i

/** Discount / coupon code ask — including common typos (הנלה). */
export function isCouponCodeRequest(text: string) {
  const body = text.trim()
  if (!body || body.length > 240) return false
  return (
    /(?:קוד\s*(?:ה)?(?:נחה|קופון)|קופון\s*(?:ה)?נחה|coupon\s*code|discount\s*code)/i.test(
      body
    ) ||
    /(?:קוד|קופון).{0,16}(?:נחה|נלה|הנחה|coupon)/i.test(body) ||
    /(?:נשמח|רוצ(?:ה|ים|ות)|אפשר|יש).{0,28}(?:קוד|קופון)/i.test(body) ||
    /(?:אולי\s+)?יש\s+קוד/i.test(body)
  )
}

function pickString(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return null
}

function parseDate(value: string | null) {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : new Date(parsed)
}

/** Date-only end dates (YYYY-MM-DD) count through end of that calendar day. */
function parseEndDate(value: string | null) {
  if (!value) return null
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = Date.parse(`${trimmed}T23:59:59.999`)
    return Number.isNaN(parsed) ? null : new Date(parsed)
  }
  return parseDate(trimmed)
}

function inferStatus(
  row: Record<string, unknown>,
  start: string | null,
  end: string | null
): CampaignRecord["status"] {
  const explicit = pickString(row, ["status", "state", "campaignStatus"])
  if (explicit) {
    if (/active|פעיל|תקף|valid/i.test(explicit)) return "active"
    if (/expir|ended|פג|לא\s+תקף|inactive/i.test(explicit)) return "expired"
  }

  const activeFlag = row.active ?? row.isActive ?? row.valid
  if (activeFlag === true || activeFlag === "true" || activeFlag === 1) return "active"
  if (activeFlag === false || activeFlag === "false" || activeFlag === 0) return "expired"

  const startDate = parseDate(start)
  if (startDate && startDate.getTime() > Date.now()) return "expired"

  const endDate = parseEndDate(end)
  if (endDate) return endDate.getTime() >= Date.now() ? "active" : "expired"
  return "unknown"
}

function normalizeCampaignRow(row: unknown): CampaignRecord | null {
  if (typeof row !== "object" || row == null) return null
  const record = row as Record<string, unknown>
  const name = pickString(record, [
    "campaign_name",
    "name",
    "title",
    "campaignName",
    "campaign",
    "description",
    "CAMPAIGNNAME",
  ])
  if (!name) return null

  const start = pickString(record, [
    "start_date",
    "startDate",
    "start",
    "validFrom",
    "fromDate",
    "dateFrom",
    "CAMPAIGNSTART",
  ])
  const end = pickString(record, [
    "end_date",
    "endDate",
    "end",
    "validTo",
    "toDate",
    "dateTo",
    "CAMPAIGNEND",
  ])

  const couponCode = pickString(record, [
    "coupon_code",
    "couponCode",
    "coupon",
    "COUPONCODE",
  ])
  const validFor = pickString(record, ["valid_for", "validFor", "channel"])

  return {
    name,
    start,
    end,
    status: inferStatus(record, start, end),
    couponCode,
    validFor,
    raw: record,
  }
}

function extractCampaignRows(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    const unwrapped = data.flatMap((item) => {
      if (typeof item !== "object" || item == null) return [item]
      const record = item as Record<string, unknown>
      if (Array.isArray(record.campaigns)) return record.campaigns
      if (Array.isArray(record.result)) return record.result
      return [item]
    })
    if (unwrapped.some((item) => normalizeCampaignRow(item) != null)) {
      return unwrapped
    }
    return unwrapped
  }

  if (typeof data === "object" && data != null) {
    const record = data as Record<string, unknown>
    if (Array.isArray(record.campaigns)) return record.campaigns
    if (Array.isArray(record.result)) return record.result
    return [data]
  }

  return []
}

export function parseCampaignPayload(data: unknown): CampaignRecord[] {
  return extractCampaignRows(data)
    .map(normalizeCampaignRow)
    .filter((row): row is CampaignRecord => row != null)
}

export function isCampaignQuestion(text: string) {
  const body = text.trim()
  return CAMPAIGN_QUESTION_RE.test(body) || isCouponCodeRequest(body)
}

export function resolveCampaignLookupValue(body: string, hint?: string | null) {
  const trimmedHint = hint?.trim()
  if (trimmedHint && trimmedHint.toLowerCase() !== "all") return trimmedHint

  if (/1\s*\+\s*1/i.test(body)) return "1+1"

  const match = body.match(
    /(?:ה)?(?:מבצע|הנח(?:ה|ות)|קופון|campaign)\s+(?:ש(?:ל|ה)?\s*)?([א-תa-zA-Z0-9+\-%]+(?:\s+[א-תa-zA-Z0-9+\-%]+){0,4})/i
  )
  const extracted = match?.[1]?.trim().replace(/\s+עדיין.*$/i, "").trim()
  return extracted || "all"
}

export async function fetchCampaigns(value = "all") {
  const data = await callPriorityWebhook({
    actionType: "getCampaigns",
    value: value.trim() || "all",
  })
  if (data == null) return undefined
  return parseCampaignPayload(data)
}

function formatHebrewDate(value: string | null) {
  const formatted = formatHebrewCustomerDate(value ?? undefined)
  if (formatted) return formatted
  return value
}

function normalizeQuery(query: string) {
  return query.trim().toLowerCase().replace(/\s+/g, " ")
}

function campaignMatchesQuery(campaign: CampaignRecord, query: string, body = "") {
  if (query === "all") return true

  const q = normalizeQuery(query)
  const name = campaign.name.toLowerCase()
  const corpus = `${q} ${body}`.toLowerCase()

  if (name.includes(q)) return true

  if (/1\s*\+\s*1|1\+1/i.test(q) && /1\s*\+\s*1|1\+1/i.test(name)) return true
  if (/פופ|bean/i.test(corpus) && /פופ/i.test(name)) return true
  if (/\d+\s*%/.test(q)) {
    const pct = q.match(/\d+\s*%/)?.[0]?.replace(/\s+/g, "")
    if (pct && name.includes(pct.replace("%", ""))) return true
  }

  const tokens = q.split(/[\s\-+]+/).filter((token) => token.length >= 2 || /^\d/.test(token))
  if (tokens.length > 0 && tokens.every((token) => name.includes(token))) return true

  return false
}

function pickBestCampaignMatch(
  campaigns: CampaignRecord[],
  query: string,
  body = ""
) {
  const matches = campaigns.filter((campaign) => campaignMatchesQuery(campaign, query, body))
  if (matches.length === 0) return null
  if (matches.length === 1) return matches[0]!

  const ranked = [...matches].sort((left, right) => {
    const leftName = left.name.toLowerCase()
    const rightName = right.name.toLowerCase()
    const q = normalizeQuery(query)
    const leftExact = leftName.includes(q) ? 1 : 0
    const rightExact = rightName.includes(q) ? 1 : 0
    if (leftExact !== rightExact) return rightExact - leftExact
    if (left.status === "active" && right.status !== "active") return -1
    if (right.status === "active" && left.status !== "active") return 1
    return 0
  })

  return ranked[0] ?? null
}

function describeCampaignName(name: string) {
  const trimmed = name.trim()
  if (/1\s*\+\s*1/i.test(trimmed) && /פופ/i.test(trimmed)) {
    return "מבצע 1+1 על הפופים"
  }
  if (/1\s*\+\s*1/i.test(trimmed)) {
    return "מבצע 1+1"
  }
  return `מבצע ${trimmed}`
}

function formatEndedAgo(end: string | null, now = Date.now()) {
  const endDate = parseEndDate(end)
  if (!endDate || endDate.getTime() >= now) return null
  const days = Math.max(1, Math.ceil((now - endDate.getTime()) / 86_400_000))
  if (days === 1) return "אתמול"
  return `לפני ${days} ימים`
}

function formatCouponValidityNote(campaign: CampaignRecord) {
  if (campaign.validFor === "website_only") return " — להזין בעגלת הקניות באתר"
  if (campaign.validFor?.trim()) return ` — ${campaign.validFor}`
  return " — להזין בעגלת הקניות"
}

function formatActiveCouponLine(campaign: CampaignRecord) {
  if (campaign.status !== "active" || !campaign.couponCode) return ""
  return `\n\nקוד הקופון: ${campaign.couponCode}${formatCouponValidityNote(campaign)}.`
}

function formatSingleCampaignReply(
  campaign: CampaignRecord,
  query: string,
  wantsCoupon = false
) {
  const label = describeCampaignName(campaign.name)

  if (campaign.status === "active") {
    const until = campaign.end ? ` (עד ${formatHebrewDate(campaign.end)})` : ""
    const coupon =
      wantsCoupon || campaign.couponCode ? formatActiveCouponLine(campaign) : ""
    if (wantsCoupon && !campaign.couponCode) {
      return `${label} עדיין בתוקף${until}, אבל לא מופיע במערכת קוד קופון לשיתוף.`
    }
    return `כן 😊 ${label} עדיין בתוקף${until}!${coupon}`
  }

  const ago = formatEndedAgo(campaign.end)
  const expiredLead = ago
    ? `אכן היה ${label}, אך לצערי הוא כבר אינו בתוקף — נגמר ${ago}.`
    : `אכן היה ${label}, אך לצערי הוא כבר אינו בתוקף.`
  if (wantsCoupon && campaign.couponCode) {
    return `${expiredLead}\n\nקוד קופון שמופיע במערכת (${campaign.couponCode}) — **לא בתוקף**; לא ניתן להשתמש בו.`
  }
  return expiredLead
}

function formatActiveCouponCodesReply(active: CampaignRecord[]) {
  const withCodes = active.filter((campaign) => campaign.couponCode)
  if (withCodes.length === 0) {
    const names = active.slice(0, 3).map((campaign) => describeCampaignName(campaign.name))
    if (names.length === 0) {
      return "כרגע לא מצאתי מבצעים פעילים עם קוד קופון במערכת 😊 אפשר ליועץ מכירות לבדוק אם יש משהו מיוחד."
    }
    return `יש ${names.length} מבצעים פעילים (${names.join(", ")}), אבל לא מופיע במערכת קוד קופון לשיתוף.`
  }

  if (withCodes.length === 1) {
    const campaign = withCodes[0]!
    const until = campaign.end ? ` (עד ${formatHebrewDate(campaign.end)})` : ""
    return `${describeCampaignName(campaign.name)} בתוקף${until}.${formatActiveCouponLine(campaign)}`
  }

  const lines = withCodes.slice(0, 4).map((campaign) => {
    const until = campaign.end ? ` עד ${formatHebrewDate(campaign.end)}` : ""
    return `• ${describeCampaignName(campaign.name)}${until}: קוד ${campaign.couponCode}`
  })
  return `כן 😊 יש ${withCodes.length} מבצעים פעילים עם קוד:\n${lines.join("\n")}`
}

function formatActiveCampaignsOverview(active: CampaignRecord[]) {
  if (active.length === 0) {
    return "כרגע לא מצאתי מבצעים פעילים במערכת 😊 אפשר לחבר ליועץ מכירות לבדוק אם יש משהו מיוחד."
  }

  if (active.length === 1) {
    return formatSingleCampaignReply(active[0]!, "all")
  }

  const names = active.slice(0, 3).map((campaign) => describeCampaignName(campaign.name))
  return `כן 😊 כרגע יש ${names.length} מבצעים פעילים: ${names.join(", ")}. רוצים פרטים על אחד מהם?`
}

export function formatCampaignLookupReply(
  campaigns: CampaignRecord[],
  query: string,
  body = ""
) {
  const wantsCoupon = isCouponCodeRequest(body)

  if (campaigns.length === 0) {
    return `${CUSTOMER_HEADER}
בדקתי בשבילכם 😊
לא מצאתי מבצע${query !== "all" ? ` שמתאים ל"${query}"` : "ים"} במערכת.
אם תרצו — אפשר להעביר ליועץ מכירות לפרטים נוספים 🙏`
  }

  if (query !== "all") {
    const match = pickBestCampaignMatch(campaigns, query, body)
    if (!match) {
      return `${CUSTOMER_HEADER}
בדקתי בשבילכם 😊
לא מצאתי במערכת מבצע שמתאים ל"${query}".
אם תרצו — אפשר להעביר ליועץ מכירות 🙏`
    }

    return `${CUSTOMER_HEADER}
בדקתי בשבילכם 😊

${formatSingleCampaignReply(match, query, wantsCoupon)}

אם צריך — אפשר להעביר ליועץ מכירות לפרטים נוספים 🙏`
  }

  const active = campaigns.filter((campaign) => campaign.status === "active")

  return `${CUSTOMER_HEADER}
בדקתי בשבילכם 😊

${wantsCoupon ? formatActiveCouponCodesReply(active) : formatActiveCampaignsOverview(active)}

אם צריך — אפשר להעביר ליועץ מכירות 🙏`
}

export async function resolveCampaignLookupReply(input: {
  body: string
  campaignHint?: string | null
}) {
  const value = resolveCampaignLookupValue(input.body, input.campaignHint)
  const campaigns = await fetchCampaigns(value)
  if (campaigns === undefined) {
    return `${CUSTOMER_HEADER}
לא הצלחתי לבדוק את המבצעים כרגע 😊
אפשר לנסות שוב עוד כמה רגעים, או להעביר ליועץ מכירות 🙏`
  }
  return formatCampaignLookupReply(campaigns, value, input.body)
}
