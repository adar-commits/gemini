/** Debug session NDJSON — POST to Cursor ingest (local dev) + console for Vercel. */
const DEBUG_ENDPOINT = "http://127.0.0.1:7345/ingest/35404141-892c-44d8-8782-483df1d9a368"
const DEBUG_SESSION = "42e68b"

export function debugSessionLog(input: {
  location: string
  message: string
  hypothesisId: string
  data?: Record<string, unknown>
  runId?: string
}) {
  const payload = {
    sessionId: DEBUG_SESSION,
    timestamp: Date.now(),
    ...input,
  }
  // #region agent log
  console.error("[debug-42e68b]", JSON.stringify(payload))
  fetch(DEBUG_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": DEBUG_SESSION,
    },
    body: JSON.stringify(payload),
  }).catch(() => {})
  // #endregion
}
