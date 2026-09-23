import { execSync } from "node:child_process"
import {
  formatQaFixGuardReport,
  scanUnifiedDiff,
} from "../lib/hom-agent/qa-fix-guard"

function gitDiff(args: string) {
  try {
    return execSync(`git diff ${args}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim()
  } catch {
    return ""
  }
}

function collectDiff(mode: "working" | "commit" | "staged") {
  if (mode === "commit") {
    const commitDiff = gitDiff("HEAD~1 HEAD")
    if (commitDiff) return commitDiff
    return gitDiff("HEAD")
  }
  if (mode === "staged") {
    return gitDiff("--cached")
  }
  const staged = gitDiff("--cached")
  const unstaged = gitDiff("")
  return [staged, unstaged].filter(Boolean).join("\n")
}

function main() {
  const modeArg = process.argv.find((arg) => arg.startsWith("--"))
  const mode =
    modeArg === "--commit"
      ? "commit"
      : modeArg === "--staged"
        ? "staged"
        : "working"

  const diff = collectDiff(mode)
  if (!diff) {
    console.log("qa-fix-guard: OK — no diff to scan.")
    return
  }

  const violations = scanUnifiedDiff(diff)
  console.log(formatQaFixGuardReport(violations))
  if (violations.length) process.exit(1)
}

main()
