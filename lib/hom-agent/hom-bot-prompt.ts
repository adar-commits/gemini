import { readFileSync } from "node:fs"
import { join } from "node:path"
import { shouldIncludeDepartmentPlaybook } from "@/lib/hom-agent/playbook-guards"
import type { HistoryMessage } from "@/lib/agents/types"

const promptPath = join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md")

type ParsedSection = { title: string; body: string }

let parsedSections: ParsedSection[] | null = null

function loadHomBotSections(): ParsedSection[] {
  if (parsedSections) return parsedSections
  const markdown = readFileSync(promptPath, "utf8")
  const parts = markdown.split(/^## /m)
  parts.shift()
  parsedSections = parts.map((part) => {
    const newline = part.indexOf("\n")
    const title = (newline === -1 ? part : part.slice(0, newline)).trim()
    return { title, body: `## ${part.trim()}` }
  })
  return parsedSections
}

const CORE_TITLES = new Set([
  "Voice & identity",
  "Output contract",
  "Think want, not words",
  "Tool usage",
  "Short reply binding",
  "NEVER-do (absolute)",
  "Intake playbooks",
  "KB",
])

const DEPARTMENT_TITLE = "Department boundaries (owner-locked)"
const MUST_NOT_MATCH_TITLE = "Must-not-match examples"

function sectionByTitle(title: string) {
  return loadHomBotSections().find((section) => section.title === title)?.body ?? ""
}

/** Assemble hom-bot.md with conditional playbooks (plan I). Must-not-match always included. */
export function buildHomBotPrompt(input?: {
  history?: HistoryMessage[]
  userText?: string | null
}) {
  const sections = loadHomBotSections()
  const parts: string[] = ["# HoM Bot — Single Agent (v3)\n"]

  for (const section of sections) {
    if (CORE_TITLES.has(section.title)) {
      parts.push(section.body)
    }
  }

  parts.push(sectionByTitle(MUST_NOT_MATCH_TITLE))

  const body = input?.userText?.trim() ?? ""
  const history = input?.history ?? []
  if (shouldIncludeDepartmentPlaybook(history, body)) {
    parts.push(sectionByTitle(DEPARTMENT_TITLE))
  }

  return parts.filter(Boolean).join("\n\n")
}

/** Test helper — bytes saved when department playbook omitted. */
export function homBotDepartmentPlaybookBytes() {
  return sectionByTitle(DEPARTMENT_TITLE).length
}
