import { readFileSync } from "node:fs"
import { join } from "node:path"
import { shouldIncludeDepartmentPlaybook } from "@/lib/hom-agent/playbook-guards"
import type { HistoryMessage } from "@/lib/agents/types"
import type { ModelTier } from "@/lib/agent-core/model-orchestra"

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

/** Always in static cache prefix (plan I + J). */
const CORE_TITLES = new Set([
  "Voice & identity",
  "Output contract",
  "Tool usage",
  "Short reply binding",
  "NEVER-do (absolute)",
  "Intake playbooks",
  "KB",
])

/** Omitted on lightweight structured-bound turns; included for LLM-first / T3 (plan J). */
const REFERENCE_TITLES = new Set(["Think want, not words"])

const DEPARTMENT_TITLE = "Department boundaries (owner-locked)"
const MUST_NOT_MATCH_TITLE = "Must-not-match examples"

function sectionByTitle(title: string) {
  return loadHomBotSections().find((section) => section.title === title)?.body ?? ""
}

export type HomBotPromptInput = {
  history?: HistoryMessage[]
  userText?: string | null
  modelTier?: ModelTier | null
  llmOwnsIntent?: boolean
}

function shouldIncludeReferenceSections(input: HomBotPromptInput) {
  if (input.llmOwnsIntent) return true
  if (input.modelTier === "T3") return true
  return shouldIncludeDepartmentPlaybook({
    history: input.history ?? [],
    body: input.userText?.trim() ?? "",
    llmOwnsIntent: false,
  })
}

/** Assemble hom-bot.md with conditional playbooks (plan I/J). Must-not-match always included. */
export function buildHomBotPrompt(input?: HomBotPromptInput) {
  const sections = loadHomBotSections()
  const parts: string[] = ["# HoM Bot — Single Agent (v3)\n"]
  const includeReference = shouldIncludeReferenceSections(input ?? {})

  for (const section of sections) {
    if (CORE_TITLES.has(section.title)) {
      parts.push(section.body)
    }
  }

  if (includeReference) {
    for (const section of sections) {
      if (REFERENCE_TITLES.has(section.title)) {
        parts.push(section.body)
      }
    }
  }

  parts.push(sectionByTitle(MUST_NOT_MATCH_TITLE))

  const body = input?.userText?.trim() ?? ""
  const history = input?.history ?? []
  if (
    shouldIncludeDepartmentPlaybook({
      history,
      body,
      llmOwnsIntent: input?.llmOwnsIntent,
    })
  ) {
    parts.push(sectionByTitle(DEPARTMENT_TITLE))
  }

  return parts.filter(Boolean).join("\n\n")
}

/** Test helper — bytes saved when department playbook omitted. */
export function homBotDepartmentPlaybookBytes() {
  return sectionByTitle(DEPARTMENT_TITLE).length
}

/** Test helper — bytes saved when reference sections omitted. */
export function homBotReferenceSectionBytes() {
  return REFERENCE_TITLES.size > 0
    ? [...REFERENCE_TITLES].reduce(
        (sum, title) => sum + sectionByTitle(title).length,
        0
      )
    : 0
}
