/**
 * Static guard for HoM conversation-fix / QA automation commits.
 * Blocks the "dumb agent" techniques from conversation-fix-playbook.mdc.
 *
 * Run via: npm run guard:qa-fix
 * Bypass a specific added line (rare): append `// qa-fix-guard: allow` with reason in PR.
 */

export type QaFixGuardViolation = {
  ruleId: string
  file: string
  lineNumber: number
  line: string
  hint: string
}

/** Preferred edit targets for QA fixes — automation should stay here first. */
export const QA_FIX_PREFERRED_PATHS = [
  "lib/hom-agent/prompts/hom-bot.md",
  "lib/hom-agent/conversation-hints.ts",
  "lib/hom-agent/tools/",
  "lib/agents/order-lookup.ts",
  "lib/agents/service-intake.ts",
  "lib/hom-agent/pre-turn.ts",
  "lib/agents/inactivity-policy.ts",
  "lib/landbot/inactivity-",
  "lib/hom-agent/__tests__/",
  "lib/agents/__tests__/",
] as const

/** High-risk files — added lines are scanned strictly. */
export const QA_FIX_STRICT_GUARD_FILES = [
  "lib/hom-agent/validate-reply.ts",
  "lib/agents/off-topic.ts",
  "lib/agents/conversation-close.ts",
  "lib/agents/digital-document-flow.ts",
  "lib/agents/compound-reply.ts",
  "lib/hom-agent/pre-turn.ts",
  "lib/agents/order-lookup.ts",
  "lib/agents/inquiry-intent.ts",
  "lib/agents/shipping.ts",
] as const

const HEBREW = /[\u0590-\u05FF]/

type GuardRule = {
  id: string
  hint: string
  matches: (input: { file: string; line: string }) => boolean
}

function isTestOrFixturePath(file: string) {
  return (
    file.includes("/__tests__/") ||
    file.endsWith(".test.ts") ||
    file.includes("/fixtures/")
  )
}

function isAllowlistedLine(line: string) {
  return line.includes("qa-fix-guard: allow")
}

function isStrictGuardFile(file: string) {
  return QA_FIX_STRICT_GUARD_FILES.some(
    (path) => file === path || file.endsWith(path)
  )
}

const GUARD_RULES: GuardRule[] = [
  {
    id: "no_new_sanitize_export",
    hint:
      "Do not add sanitize* exports. Fix prompt + hints + pre-turn — see conversation-fix-playbook.mdc.",
    matches: ({ file, line }) => {
      if (isTestOrFixturePath(file)) return false
      if (isAllowlistedLine(line)) return false
      return /export function sanitize\w+/i.test(line)
    },
  },
  {
    id: "no_validate_reply_sanitizer",
    hint:
      "Do not extend validate-reply.ts with new stripping/rewriting. Teach the model instead.",
    matches: ({ file, line }) => {
      if (!file.endsWith("lib/hom-agent/validate-reply.ts")) return false
      if (isAllowlistedLine(line)) return false
      if (/export function sanitize\w+/i.test(line)) return true
      if (/function replaceRepeatedReply/i.test(line)) return false
      if (/validateHomAgentReply/.test(line) && /\.replace\s*\(/.test(line)) {
        return true
      }
      return false
    },
  },
  {
    id: "no_hebrew_customer_intent_regex",
    hint:
      "No new Hebrew regex on customer text for intent/routing. Use hom-bot.md + conversation-hints.ts.",
    matches: ({ file, line }) => {
      if (!isStrictGuardFile(file)) return false
      if (file.endsWith("lib/hom-agent/validate-reply.ts")) return false
      if (isTestOrFixturePath(file)) return false
      if (isAllowlistedLine(line)) return false
      if (!HEBREW.test(line)) return false

      const regexLike =
        /\/[^/\n]+\/[dgimsuvy]*/.test(line) ||
        /new RegExp\s*\(/.test(line) ||
        /\.test\s*\(/.test(line) ||
        /\.match\s*\(/.test(line)

      const customerScoped =
        /userText|customerText|customerMessage|latestUser|input\.text|input\.body|\bbody\b|\btext\b/i.test(
          line
        )

      const intentScoped =
        /intent|routing|handoff|confirm|document|receipt|refund|return|shipping|קבלה|החזר|משלוח/i.test(
          line
        )

      return regexLike && (customerScoped || intentScoped)
    },
  },
  {
    id: "no_pre_turn_customer_intent_arm",
    hint:
      "Pre-turn may only bind existing pending state helpers — not new customer-intent regex.",
    matches: ({ file, line }) => {
      if (!file.endsWith("lib/hom-agent/pre-turn.ts")) return false
      if (isAllowlistedLine(line)) return false
      if (/export function runStructured\w+PreTurn/.test(line)) return true
      if (!HEBREW.test(line)) return false
      return (
        /userText|customerText|\bbody\b/i.test(line) &&
        (/\.test\s*\(|\.match\s*\(|includes\s*\(|new RegExp\s*\(/.test(line) ||
          /\/[^/\n]+\/[dgimsuvy]*/.test(line))
      )
    },
  },
  {
    id: "no_digital_document_noun_hijack",
    hint:
      "Do not add noun-only document/receipt detectors. Defer to LLM or thread-state guards.",
    matches: ({ file, line }) => {
      if (!file.endsWith("lib/agents/digital-document-flow.ts")) return false
      if (isAllowlistedLine(line)) return false
      if (/export function isDigitalDocumentRequest/.test(line)) return false
      return (
        /export function is\w+/.test(line) &&
        HEBREW.test(line) &&
        (/\.test\s*\(|new RegExp\s*\(/.test(line) || /\/[^/\n]+\/[dgimsuvy]*/.test(line))
      )
    },
  },
]

export function scanAddedLine(input: {
  file: string
  lineNumber: number
  line: string
}): QaFixGuardViolation[] {
  const trimmed = input.line.replace(/^\+\s?/, "")
  if (!trimmed || trimmed.startsWith("+++") || trimmed.startsWith("@@")) {
    return []
  }
  if (trimmed.startsWith("-")) return []

  const violations: QaFixGuardViolation[] = []
  for (const rule of GUARD_RULES) {
    if (
      rule.matches({
        file: input.file.replace(/\\/g, "/"),
        line: trimmed,
      })
    ) {
      violations.push({
        ruleId: rule.id,
        file: input.file,
        lineNumber: input.lineNumber,
        line: trimmed,
        hint: rule.hint,
      })
    }
  }
  return violations
}

/** Parse unified diff text into per-file added lines. */
export function scanUnifiedDiff(diff: string): QaFixGuardViolation[] {
  const violations: QaFixGuardViolation[] = []
  let currentFile = ""
  let lineNumber = 0

  for (const rawLine of diff.split("\n")) {
    if (rawLine.startsWith("+++ b/")) {
      currentFile = rawLine.slice("+++ b/".length).trim()
      continue
    }
    if (rawLine.startsWith("@@")) {
      const match = rawLine.match(/\+(\d+)/)
      lineNumber = match ? Number(match[1]) : 0
      continue
    }
    if (!currentFile || currentFile === "/dev/null") continue

    if (rawLine.startsWith("+") && !rawLine.startsWith("+++")) {
      violations.push(
        ...scanAddedLine({
          file: currentFile,
          lineNumber,
          line: rawLine,
        })
      )
      lineNumber += 1
      continue
    }
    if (rawLine.startsWith(" ") || rawLine.startsWith("-")) {
      if (!rawLine.startsWith("-")) lineNumber += 1
    }
  }

  return violations
}

export function formatQaFixGuardReport(violations: QaFixGuardViolation[]) {
  if (!violations.length) {
    return "qa-fix-guard: OK — no forbidden QA fix patterns in diff."
  }

  const lines = [
    "qa-fix-guard: BLOCKED — forbidden QA fix techniques detected.",
    "",
    "Read .cursor/rules/conversation-fix-playbook.mdc and structured-vs-llm-routing.mdc.",
    "Allowed first: hom-bot.md, conversation-hints.ts, tool thread guards, existing pre-turn helpers.",
    "",
  ]

  for (const violation of violations) {
    lines.push(
      `[${violation.ruleId}] ${violation.file}:${violation.lineNumber}`,
      `  ${violation.line}`,
      `  → ${violation.hint}`,
      ""
    )
  }

  return lines.join("\n").trimEnd()
}
