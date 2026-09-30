/**
 * Re-run failed QA webhooks sequentially via production API (needs AGENT_API_KEY).
 *
 *   AGENT_API_KEY=... npx tsx scripts/run-retry-failed-qa-batch.ts --since 2026-09-30T08:26:00+00
 */
function productionOrigin() {
  const raw =
    process.env.GEMINI_API_ORIGIN?.trim() ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  if (!raw) return "https://gemini-xi-one-77.vercel.app"
  return raw.startsWith("http") ? raw : `https://${raw}`
}

const ORIGIN = productionOrigin()

function arg(name: string) {
  const idx = process.argv.indexOf(name)
  return idx >= 0 ? process.argv[idx + 1]?.trim() : ""
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function api(path: string, init?: RequestInit) {
  const key = process.env.AGENT_API_KEY?.trim()
  if (!key) throw new Error("Set AGENT_API_KEY")
  const response = await fetch(`${ORIGIN}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  })
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok) {
    throw new Error(String(body.error ?? response.statusText))
  }
  return body
}

const IN_FLIGHT = new Set(["triggered", "chained"])

async function waitForSettled(id: string, waitMin: number) {
  const deadline = Date.now() + waitMin * 60_000
  while (Date.now() < deadline) {
    await sleep(15_000)
    const status = (await api(
      `/api/agents/qa-runs/retry?id=${encodeURIComponent(id)}`
    )) as { outcome?: string }
    const outcome = String(status.outcome ?? "")
    if (!IN_FLIGHT.has(outcome)) return outcome
  }
  const status = (await api(
    `/api/agents/qa-runs/retry?id=${encodeURIComponent(id)}`
  )) as { outcome?: string }
  return String(status.outcome ?? "timeout")
}

async function main() {
  const since = arg("--since")
  const waitMin = Number(arg("--wait-min") || "15")
  const dryRun = process.argv.includes("--dry-run")
  if (!since) {
    console.error("Usage: --since ISO timestamp (e.g. 2026-09-30T08:26:00+00)")
    process.exit(1)
  }

  const list = (await api(
    `/api/agents/qa-runs/retry?since=${encodeURIComponent(since)}&outcome=webhook_failed`
  )) as {
    total: number
    runs: Array<{ id: string; session_id: string; created_at: string }>
  }

  console.log(`Origin: ${ORIGIN}`)
  console.log(`Found ${list.total} webhook_failed run(s) since ${since}`)

  let ok = 0
  let failed = 0
  for (let i = 0; i < list.runs.length; i += 1) {
    const run = list.runs[i]
    const label = `[${i + 1}/${list.runs.length}] ${run.id.slice(0, 8)} session=${run.session_id}`
    if (dryRun) {
      console.log(`DRY-RUN ${label}`)
      continue
    }

    console.log(`RETRY ${label}`)
    try {
      await api("/api/agents/qa-runs/retry", {
        method: "POST",
        body: JSON.stringify({ id: run.id }),
      })
      const outcome = await waitForSettled(run.id, waitMin)
      console.log(`  → ${outcome}`)
      if (outcome === "webhook_failed") failed += 1
      else ok += 1
    } catch (error) {
      failed += 1
      console.log(`  FAIL ${error instanceof Error ? error.message : error}`)
    }
    await sleep(5_000)
  }

  console.log(`Done. settled=${ok} failed=${failed}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
