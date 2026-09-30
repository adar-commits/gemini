"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const tabs = [
  { href: "/dashboard/qa", label: "אירועים", exact: true },
  { href: "/dashboard/qa/insights", label: "תובנות לפיתוח", exact: false },
]

export function QaSubNav() {
  const pathname = usePathname()

  return (
    <div className="border-b border-black/[0.06] bg-white/70 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl gap-1 px-5 py-2">
        {tabs.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href || pathname.startsWith(`${tab.href}?`)
            : pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={
                active
                  ? "rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white"
                  : "rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              }
            >
              {tab.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
