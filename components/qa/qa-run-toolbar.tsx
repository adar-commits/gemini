"use client"

import { useTransition } from "react"
import { deleteQaRunAction, retryQaRunAction } from "@/app/dashboard/qa/actions"
import { QA_RUN_RETRY_LABEL } from "@/lib/landbot/qa-run-retry"

function iconButtonClass(disabled: boolean) {
  return `rounded-lg p-1.5 transition disabled:opacity-50 ${disabled ? "" : ""}`
}

function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}

function RetryIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  )
}

export function QaRunToolbar({
  runId,
  canRetry,
}: {
  runId: string
  canRetry: boolean
}) {
  const [pending, startTransition] = useTransition()

  function handleDelete() {
    if (!window.confirm("למחוק את האירוע מהדשבורד?")) return
    startTransition(async () => {
      await deleteQaRunAction(runId)
    })
  }

  function handleRetry() {
    if (!canRetry) return
    startTransition(async () => {
      const result = await retryQaRunAction(runId)
      if (!result.ok && result.error) {
        window.alert(result.error)
      }
    })
  }

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {canRetry ? (
        <button
          type="button"
          onClick={handleRetry}
          disabled={pending}
          title={QA_RUN_RETRY_LABEL}
          aria-label={QA_RUN_RETRY_LABEL}
          className={`${iconButtonClass(pending)} text-zinc-400 ring-1 ring-transparent hover:bg-sky-50 hover:text-sky-700 hover:ring-sky-100`}
        >
          <RetryIcon />
        </button>
      ) : null}
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        title="מחק אירוע"
        aria-label="מחק אירוע"
        className={`${iconButtonClass(pending)} text-zinc-400 ring-1 ring-transparent hover:bg-rose-50 hover:text-rose-600 hover:ring-rose-100`}
      >
        <TrashIcon />
      </button>
    </div>
  )
}
