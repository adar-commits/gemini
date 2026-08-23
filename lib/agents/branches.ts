import { readFileSync } from "node:fs"
import { join } from "node:path"

const kbPath = join(process.cwd(), "lib/agents/kb/faq.md")

const DEFAULT_HOURS = "א'-ה' 09:30-19:30, ו' 09:00-14:00"
const AIRPORT_HOURS = "א'-ה' 09:30-18:00, ו' 09:00-14:00"

const BRANCH_QUESTION_RE =
  /(?:איזה|מה\s+ה|רשימ(?:ת|ה)\s+)?(?:ה)?סניפ|סניפים\s+יש|לסניף|כתובות?\s+(?:ה)?סניפ|where\s+are\s+(?:your\s+)?(?:stores|branches)/i

type BranchEntry = {
  name: string
  address: string
  phone: string
  note?: string
  hoursNote?: string
}

export function isBranchListQuestion(text: string) {
  return BRANCH_QUESTION_RE.test(text.trim())
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

אפשר לעזור במשהו נוסף? כדי להתחיל מחדש, כתבו "התחלה".`
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
