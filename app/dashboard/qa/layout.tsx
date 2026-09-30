import { QaSubNav } from "@/components/qa/qa-sub-nav"

export default function QaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <QaSubNav />
      {children}
    </>
  )
}
