import Link from "next/link"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div dir="rtl" lang="he" className="min-h-screen bg-[#f6f5f3]">
      <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <nav className="flex items-center gap-1 text-sm">
            <Link
              href="/dashboard/goku"
              className="rounded-lg px-3 py-1.5 font-semibold text-foreground"
            >
              גוקו מאמן
            </Link>
            <Link
              href="/dashboard"
              className="rounded-lg px-3 py-1.5 text-muted-foreground transition-colors hover:bg-black/[0.04] hover:text-foreground"
            >
              מוצרים
            </Link>
          </nav>
          <span className="hidden text-xs text-muted-foreground sm:block">
            HoM · בקרת שיחות
          </span>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
