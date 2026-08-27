import { readFileSync } from "node:fs"
import { join } from "node:path"

const kbPath = join(process.cwd(), "lib/agents/kb/faq.md")

const DEFAULT_HOURS = "א'-ה' 09:30-19:30, ו' 09:00-14:00"
const AIRPORT_HOURS = "א'-ה' 09:30-18:00, ו' 09:00-14:00"

const BRANCH_QUESTION_RE =
  /(?:איזה|מה\s+ה|רשימ(?:ת|ה)\s+)?(?:ה)?סני[פף](?:ים|ה)?|סניפים\s+יש|לסני[פף]|כתובות?\s+(?:ה)?סני[פף](?:ים|ה)?|יש\s+(?:ל(?:כם|נו)\s+)?סני[פף](?:ים|ה)?|סני[פף](?:ים|ה)?\s+(?:ב|ש(?:ל|ב)?\s+)?|where\s+are\s+(?:your\s+)?(?:stores|branches)/i

const BRANCH_HOURS_RE =
  /(?:עד\s+מתי|מתי|מחר|היום|מוצ["']?ש).*?(?:פתוח|סגור|שעות)|(?:פתוח|סגור|שעות\s+(?:פעילות|פתיחה)).*?(?:סני[פף]|מחר|היום)/i

/** Common Hebrew city abbreviations → canonical branch names from KB. */
const CITY_ALIASES: Array<{ pattern: RegExp; canonical: string }> = [
  { pattern: /ראשל(?:["״']?צ|ון(?:\s*לציון)?)/i, canonical: "ראשון לציון" },
  { pattern: /ת(?:["״']?א|ל\s*א[-\s]?אביב)/i, canonical: "תל אביב" },
  { pattern: /ב(?:["״']?ש|אר\s*שבע)/i, canonical: "באר שבע" },
  { pattern: /פ(?:["״']?ת|תח\s*תקו?וה)/i, canonical: "פתח תקווה" },
  { pattern: /ב(?:["״']?ב|ני\s*ברק)/i, canonical: "בני ברק" },
  { pattern: /ק(?:["״']?ר|ריית\s*אתא)/i, canonical: "קריית אתא" },
  { pattern: /נ(?:["״']?ת|תניה)/i, canonical: "נתניה" },
]

export function normalizeBranchCityHint(hint: string) {
  const trimmed = hint.trim().replace(/["״']/g, "")
  for (const { pattern, canonical } of CITY_ALIASES) {
    if (pattern.test(trimmed) || pattern.test(hint.trim())) return canonical
  }
  return hint.trim()
}

const CITY_IN_BRANCH_QUERY_RE =
  /(?:ב|ב-)([א-ת'"\s]{2,20}?)(?:\?|[\s,.]|$)|(?:^|\s)([א-ת'"\s]{2,15})\s*—\s*סניף/i

type BranchEntry = {
  name: string
  address: string
  phone: string
  note?: string
  hoursNote?: string
}

export function isBranchListQuestion(text: string) {
  const normalized = text.trim()
  if (
    /מלאi|זמינות|במלאi|inventory|in\s+stock|בדוק(?:\s+לי|\s+ל)?\s*(?:את\s+)?(?:ה)?מלאi|תבדוק(?:\s+לי|\s+ל)?\s*(?:את\s+)?(?:ה)?מלאi/i.test(
      normalized
    ) &&
    /סניפ|סניף|חנות|store|branch/i.test(normalized)
  ) {
    return false
  }
  return BRANCH_QUESTION_RE.test(normalized) || BRANCH_HOURS_RE.test(normalized)
}

function branchSectionFromKb() {
  const kb = readFileSync(kbPath, "utf8")
  const match = kb.match(
    /## Branches — השטיח האדום \/ shared network\n([\s\S]*?)(?=\n## |\n$)/
  )
  return match?.[1]?.trim() ?? ""
}

function stripHours(text: string) {
  return text
    .replace(/\.\s*Hours:\s*[^.]+\.?/i, ".")
    .replace(/\.\s*א'-ה'[^.]+\./g, ".")
    .replace(/\s*א'-ה'[^.]+\.?$/g, "")
    .replace(/\.\s*\./g, ".")
    .trim()
}

function parseBranchLine(line: string): BranchEntry | null {
  const raw = line.replace(/^- /, "").trim()
  const dash = raw.indexOf(" — ")
  if (dash === -1) return null

  const name = raw.slice(0, dash).trim()
  let rest = raw.slice(dash + 3).trim()
  const phoneMatch = rest.match(/(\d{3}-\d{7})/)
  const phone = phoneMatch?.[1] ?? ""
  if (phone) rest = rest.replace(phone, "").trim()

  let note: string | undefined
  if (/פתיחה בקרוב/i.test(rest)) {
    note = "הפתיחה בקרוב"
    rest = rest.replace(/הפתיחה בקרוב\.?\s*/i, "")
  }

  const hoursNote =
    name.includes("איירפורט") || rest.includes("איירפורט סיטי")
      ? AIRPORT_HOURS
      : undefined

  const address = stripHours(rest)
    .replace(/^[\s.,]+|[\s.,]+$/g, "")
    .replace(/\s*\.\s*$/, "")

  return { name, address, phone, note, hoursNote }
}

function parseBranches(section: string): BranchEntry[] {
  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map(parseBranchLine)
    .filter((entry): entry is BranchEntry => Boolean(entry))
}

function formatBranchBlock(entry: BranchEntry) {
  const title = entry.note ? `*${entry.name}* (${entry.note})` : `*${entry.name}*`
  const details = [entry.address, entry.phone].filter(Boolean).join(" · ")
  return `${title}\n${details}`
}

export function buildBranchListReply() {
  const entries = parseBranches(branchSectionFromKb())
  return formatBranchList(entries)
}

function findBranchCityHint(text: string) {
  const normalized = text.trim()
  const match =
    normalized.match(/(?:ב)?סניף\s+([א-ת'"\s״]+?)(?:\s+של|\?|[\s,.]|$)/i) ||
    normalized.match(/סני[פף](?:ים|ה)?\s+ב([א-ת'"\s״]+?)(?:\?|[\s,.]|$)/i) ||
    normalized.match(
      /סני[פף](?:ים|ה)?\s+(?:ש(?:ל|ב)\s+)?([א-ת'"\s״]+?)(?:\s+פתוח|\?|$)/i
    ) ||
    normalized.match(/(?:יש\s+(?:ל(?:כם|נו)\s+)?סני[פף](?:ים|ה)?\s+)(?:ב)?([א-ת'"\s״]+?)(?:\?|[\s,.]|$)/i) ||
    normalized.match(CITY_IN_BRANCH_QUERY_RE)

  const city = match?.[1]?.trim() || match?.[2]?.trim()
  return city ? normalizeBranchCityHint(city) : null
}

/** City named in a branch stock-check question (e.g. בסניף ראשל"צ). */
export function extractBranchCityFromInventoryQuery(text: string) {
  return findBranchCityHint(text)
}

/** Full list or a single branch when the customer names a city (e.g. נתניה). */
export function buildBranchReplyForText(text: string) {
  const entries = parseBranches(branchSectionFromKb())
  const cityHint = findBranchCityHint(text)
  if (!cityHint) return formatBranchList(entries)

  const filtered = entries.filter(
    (entry) =>
      entry.name.includes(cityHint) ||
      entry.address.includes(cityHint) ||
      cityHint.includes(entry.name) ||
      normalizeBranchCityHint(entry.name) === normalizeBranchCityHint(cityHint)
  )

  if (filtered.length === 1) {
    const entry = filtered[0]!
    const hours = entry.hoursNote ?? DEFAULT_HOURS
    return `*${entry.name}*
${entry.address}${entry.phone ? ` · ${entry.phone}` : ""}
*שעות פעילות:* ${hours}

אם צריך עוד משהו — כאן.`
  }

  if (filtered.length > 1) return formatBranchList(filtered)
  return formatBranchList(entries)
}

function formatBranchList(entries: BranchEntry[]) {
  const blocks =
    entries.length > 0
      ? entries.map(formatBranchBlock).join("\n\n")
      : `*ראשון לציון* · לישנסקי 10 · 054-7109910
(ועוד סניפים ברשת — פרטים בקרוב)`

  const hasAirportException = entries.some((entry) => entry.hoursNote)

  return `*סניפי רשת השטיח האדום*
ניתן להחזיר ולהחליף בסניפים הפעילים:

${blocks}

*שעות פעילות (רוב הסניפים):*
${DEFAULT_HOURS}${
    hasAirportException
      ? `\n*איירפורט סיטי:* א'-ה' 09:30-18:00 · ו' 09:00-14:00`
      : ""
  }

אם צריך עוד משהו — כאן.`
}

export type UncertaintyDepartment = "service" | "sales" | "faq"

export function uncertaintyHandoffLine(department: UncertaintyDepartment) {
  const labels: Record<UncertaintyDepartment, string> = {
    service: "מחלקת שירות לקוחות",
    sales: "מחלקת מכירות",
    faq: "מחלקת מידע ושירות",
  }
  return `כדי להמשיך לטפל בפנייה בצורה מדויקת, אעביר את השיחה ל${labels[department]} לסיוע נוסף.`
}
