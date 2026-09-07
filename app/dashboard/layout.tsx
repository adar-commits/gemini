import Link from "next/link"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container mx-auto flex h-14 items-center justify-between px-6">
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/dashboard" className="font-semibold text-foreground">
              HoM Dashboard
            </Link>
            <Link
              href="/dashboard/goku"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              GOKU Trainer
            </Link>
          </nav>
          <p className="text-muted-foreground hidden text-xs sm:block">
            Post-conversation QA &amp; retraining
          </p>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
