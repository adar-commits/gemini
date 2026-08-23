import { readFileSync } from "node:fs"
import { join } from "node:path"

const kbPath = join(process.cwd(), "lib/agents/kb/faq.md")

const BRANCH_QUESTION_RE =
  /(?:איזה|מה\s+ה|רשימ(?:ת|ה)\s+)?(?:ה)?סניפ|סניפים\s+יש|לסניף|כתובות?\s+(?:ה)?סניפ|where\s+are\s+(?:your\s+)?(?:stores|branches)/i

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

function formatBranchLines(section: string) {
  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.replace(/^- /, "• "))
}

export function buildBranchListReply() {
  const section = branchSectionFromKb()
  const branches = formatBranchLines(section)
  const list = branches.length
    ? branches.join("\n")
    : "• ראשון לציון, נתניה, בני ברק, פתח תקווה, איירפורט סיטי, קריית אתא (ובאר שבע — בקרוב)"

  return `סניפי רשת השטיח האדום (ניתן להחזיר/להחליף בסניפים הפעילים):

${list}

שעות רשת: א'-ה' 09:30-19:30, ו' 09:00-14:00. באיירפורט סיטי: א'-ה' עד 18:00.
רשימה מלאה: https://www.carpetshop.co.il/pages/%D7%A1%D7%A0%D7%99%D7%A4%D7%99%D7%9D-%D7%94%D7%A9%D7%98%D7%99%D7%97-%D7%94%D7%90%D7%93%D7%95%D7%9D

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
