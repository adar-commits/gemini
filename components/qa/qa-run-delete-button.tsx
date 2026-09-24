"use client"

import { useTransition } from "react"
import { deleteQaRunAction } from "@/app/dashboard/qa/actions"

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

export function QaRunDeleteButton({ runId }: { runId: string }) {
  const [pending, startTransition] = useTransition()

  function handleDelete() {
    if (!window.confirm("למחוק את האירוע מהדשבורד?")) return
    startTransition(async () => {
      await deleteQaRunAction(runId)
    })
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={pending}
      title="מחק אירוע"
      aria-label="מחק אירוע"
      className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
    >
      <TrashIcon />
    </button>
  )
}
