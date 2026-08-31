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

function inferStatus(row: Record<string, unknown>, end: string | null): CampaignRecord["status"] {
  const explicit = pickString(row, ["status", "state", "campaignStatus"])
  if (explicit) {
    if (/active|פעיל|תקף|valid/i.test(explicit)) return "active"
    if (/expir|ended|פג|לא\s+תקף|inactive/i.test(explicit)) return "expired"
  }

  const activeFlag = row.active ?? row.isActive ?? row.valid
  if (activeFlag === true || activeFlag === "true" || activeFlag === 1) return "active"
  if (activeFlag === false || activeFlag === "false" || activeFlag === 0) return "expired"

  const endDate = parseDate(end)
  if (endDate) return endDate.getTime() >= Date.now() ? "active" : "expired"
  return "unknown"
}

function normalizeCampaignRow(row: unknown): CampaignRecord | null {
  if (typeof row !== "object" || row == null) return null
  const record = row as Record<string, unknown>
  const name = pickString(record, [
    "name",
    "title",
    "campaignName",
    "campaign",
    "description",
    "CAMPAIGNNAME",
  ])
  if (!name) return null

  const start = pickString(record, [
    "startDate",
    "start",
    "validFrom",
    "fromDate",
    "dateFrom",
    "CAMPAIGNSTART",
  ])
  const end = pickString(record, [
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

export function parseCampaignPayload(data: unknown): CampaignRecord[] {
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === "object"
      ? Array.isArray((data as { result?: unknown }).result)
        ? (data as { result: unknown[] }).result
        : Array.isArray((data as { campaigns?: unknown }).campaigns)
          ? (data as { campaigns: unknown[] }).campaigns
          : [data]
      : []

  return rows
    .map(normalizeCampaignRow)
    .filter((row): row is CampaignRecord => row != null)
}

export function isCampaignQuestion(text: string) {
  return CAMPAIGN_QUESTION_RE.test(text.trim())
}

export function resolveCampaignLookupValue(body: string, hint?: string | null) {
  const trimmedHint = hint?.trim()
  if (trimmedHint && trimmedHint.toLowerCase() !== "all") return trimmedHint
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
    hour: "2-digit",
    minute: "2-digit",
  })
}

function statusLabel(status: CampaignRecord["status"]) {
  if (status === "active") return "פעיל / בתוקף"
  if (status === "expired") return "הסתיים / לא בתוקף"
  return "לא ידוע"
}

export function formatCampaignLookupReply(campaigns: CampaignRecord[], query: string) {
  if (campaigns.length === 0) {
    return `${CUSTOMER_HEADER}
לא מצאתי מבצעים פעילים במערכת${query !== "all" ? ` עבור "${query}"` : ""}.
אפשר לנסות לנסח אחרת, או להעביר ליועץ מכירות לפרטים נוספים.`
  }

  const lines = campaigns.slice(0, 8).map((campaign) => {
    const dates = [
      campaign.start ? `מתאריך ${formatHebrewDate(campaign.start)}` : null,
      campaign.end ? `עד ${formatHebrewDate(campaign.end)}` : null,
    ]
      .filter(Boolean)
      .join(" ")
    return `• ${campaign.name} — ${statusLabel(campaign.status)}${dates ? ` (${dates})` : ""}`
  })

  return `${CUSTOMER_HEADER}
${query !== "all" ? `בדקתי את המבצע "${query}":\n` : "אלה המבצעים שמופיעים במערכת:\n"}
${lines.join("\n")}

אם צריך פרטים נוספים על מבצע מסוים — אפשר להעביר ליועץ מכירות.`
}

export async function resolveCampaignLookupReply(input: {
  body: string
  campaignHint?: string | null
}) {
  const value = resolveCampaignLookupValue(input.body, input.campaignHint)
  const campaigns = await fetchCampaigns(value)
  if (campaigns === undefined) {
    return `${CUSTOMER_HEADER}
לא הצלחתי לבדוק את המבצעים כרגע.
אפשר לנסות שוב בעוד רגע, או להעביר ליועץ מכירות.`
  }
  return formatCampaignLookupReply(campaigns, value)
}
