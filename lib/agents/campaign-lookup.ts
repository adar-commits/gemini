import { callPriorityWebhook } from "@/lib/agents/priority-webhook"
import { CUSTOMER_HEADER } from "@/lib/agents/types"

export type CampaignRecord = {
  name: string
  start: string | null
  end: string | null
  status: "active" | "expired" | "unknown"
  raw?: Record<string, unknown>
}

const CAMPAIGN_QUESTION_RE =
  /מבצע|הנח(?:ה|ות)|קופון|campaign|בזק|1\s*\+\s*1|50\s*%|השטיח\s+האדום|pozitive|elite\s*rugs?|תקף|בתוקף|פג(?:ה|)?\s+תוקף|עדיין\s+(?:תקף|פעיל)|מתי\s+(?:נגמר|מסתיים)/i

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

function inferStatus(row: Record<string, unknown>, end: string | null): CampaignRecord["status"] {
  const explicit = pickString(row, ["status", "state", "campaignStatus"])
  if (explicit) {
    if (/active|פעיל|תקף|valid/i.test(explicit)) return "active"
    if (/expir|ended|פג|לא\s+תקף|inactive/i.test(explicit)) return "expired"
  }

  const activeFlag = row.active ?? row.isActive ?? row.valid
  if (activeFlag === true || activeFlag === "true" || activeFlag === 1) return "active"
  if (activeFlag === false || activeFlag === "false" || activeFlag === 0) return "expired"

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

  return {
    name,
    start,
    end,
    status: inferStatus(record, end),
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
  return CAMPAIGN_QUESTION_RE.test(text.trim())
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
  const date = parseDate(value)
  if (!date) return value
  return date.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  })
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

function formatSingleCampaignReply(campaign: CampaignRecord, query: string) {
  const label = describeCampaignName(campaign.name)

  if (campaign.status === "active") {
    const until = campaign.end ? ` (עד ${formatHebrewDate(campaign.end)})` : ""
    return `כן 😊 ${label} עדיין בתוקף${until}!`
  }

  const ago = formatEndedAgo(campaign.end)
  if (ago) {
    return `אכן היה ${label}, אך לצערי הוא כבר אינו בתוקף — נגמר ${ago}.`
  }

  return `אכן היה ${label}, אך לצערי הוא כבר אינו בתוקף.`
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

${formatSingleCampaignReply(match, query)}

אם צריך — אפשר להעביר ליועץ מכירות לפרטים נוספים 🙏`
  }

  const active = campaigns.filter((campaign) => campaign.status === "active")

  return `${CUSTOMER_HEADER}
בדקתי בשבילכם 😊

${formatActiveCampaignsOverview(active)}

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
