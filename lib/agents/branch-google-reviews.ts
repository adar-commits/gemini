export type BranchGoogleReview = {
  displayName: string
  reviewUrl: string | null
}

const WEBSITE_BRANCH_CODE = "3000"

const BRANCH_REVIEWS: Array<{
  displayName: string
  reviewUrl: string | null
  codes?: string[]
  labels: RegExp[]
}> = [
  {
    displayName: "בני ברק",
    reviewUrl:
      "https://search.google.com/local/writereview?placeid=ChIJIbM8IDRJHRURlxkljytHZ9c",
    labels: [/בני\s*ברק/i],
  },
  {
    displayName: "ראשון לציון",
    reviewUrl:
      "https://search.google.com/local/writereview?placeid=ChIJD-4TY4SzAhURoWab1AruIns",
    labels: [/ראשון\s*לציון/i],
  },
  {
    displayName: "איירפורט סיטי",
    reviewUrl:
      "https://search.google.com/local/writereview?placeid=ChIJr8kdbuI1HRUR6n2SHCQMqMQ",
    labels: [/איירפורט|שדה\s*התעופה|airport/i],
  },
  {
    displayName: "נתניה",
    reviewUrl:
      "https://search.google.com/local/writereview?placeid=ChIJLR4Pa0RBHRURpNac98IoHPA",
    labels: [/נתניה/i],
  },
  {
    displayName: "קריית אתא",
    reviewUrl:
      "https://search.google.com/local/writereview?placeid=ChIJlXtPB7OxHRURFdAfkl2vClQ",
    labels: [/קרי(?:ת|ית)\s*אתא/i],
  },
  {
    displayName: "סגולה (פתח תקווה)",
    reviewUrl:
      "https://search.google.com/local/writereview?placeid=ChIJ6Xt7lYs3HRUR_N7G1sBu6Zk",
    labels: [/סגולה|פתח\s*תקווה/i],
  },
  {
    displayName: "אתר",
    reviewUrl: null,
    codes: [WEBSITE_BRANCH_CODE],
    labels: [/אתר|website|אונליין|מוקד\s*מרכזי/i],
  },
]

export function isWebsiteBranch(branchCode?: string | null, branchLabel?: string | null) {
  const code = branchCode?.trim()
  if (code === WEBSITE_BRANCH_CODE) return true
  const label = branchLabel?.trim() ?? ""
  return /^(?:אתר|website|אונליין)$/i.test(label)
}

/** Map Priority branch code / label to a Google review link (null = thank-you only). */
export function resolveBranchGoogleReview(
  branchLabel: string,
  branchCode?: string | null
): BranchGoogleReview | null {
  const code = branchCode?.trim()
  const label = branchLabel.trim()

  if (isWebsiteBranch(code, label)) {
    return { displayName: "אתר", reviewUrl: null }
  }

  for (const entry of BRANCH_REVIEWS) {
    if (code && entry.codes?.includes(code)) {
      return { displayName: entry.displayName, reviewUrl: entry.reviewUrl }
    }
    if (label && entry.labels.some((pattern) => pattern.test(label))) {
      return { displayName: entry.displayName, reviewUrl: entry.reviewUrl }
    }
  }

  return null
}

/** Try to read branch name from a recent order-status assistant message. */
export function extractBranchLabelFromHistory(messages: Array<{ role: string; content: string }>) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.role !== "assistant") continue

    const inParens = message.content.match(
      /(?:לגבי|איתרנו)\s+הזמנה\s+\S+\s+\(([^)]+)\)/i
    )
    if (inParens?.[1]) return inParens[1].trim()

    const afterBranch = message.content.match(/בסניף\s+([^\n?]+)/i)
    if (afterBranch?.[1]) return afterBranch[1].trim()
  }

  return null
}
