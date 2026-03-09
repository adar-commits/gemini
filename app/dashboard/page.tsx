import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from "@/components/ui/table"

const PAGE_SIZE = 20

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: pageParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const { data: products, count, error } = await supabase
    .from("products")
    .select("*", { count: "exact" })
    .order("sku", { ascending: true })
    .range(from, to)

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-destructive">Error loading products: {error.message}</p>
      </div>
    )
  }

  const totalPages = count != null ? Math.ceil(count / PAGE_SIZE) : 0
  const hasPrev = page > 1
  const hasNext = page < totalPages

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Products</h1>
        <p className="text-muted-foreground text-sm">
          {count != null ? (
            <>
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, count)} of {count.toLocaleString()}
            </>
          ) : (
            "Loading…"
          )}
        </p>
      </div>

      <div className="rounded-md border border-border">
        <Table>
          <TableCaption>Products from catalog. Use pagination to browse.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">SKU</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="w-[80px]">Active</TableHead>
              <TableHead>Family</TableHead>
              <TableHead className="text-right w-[100px]">Price (VAT)</TableHead>
              <TableHead>Color</TableHead>
              <TableHead>Technique</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(products ?? []).map((row) => (
              <TableRow key={row.sku}>
                <TableCell className="font-mono text-muted-foreground">{row.sku}</TableCell>
                <TableCell className="font-medium">{row.product_title}</TableCell>
                <TableCell>{row.active ? "Yes" : "No"}</TableCell>
                <TableCell className="text-muted-foreground max-w-[200px] truncate">
                  {row.family_description ?? "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.baseprice_vat != null ? `₪${Number(row.baseprice_vat).toFixed(2)}` : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">{row.color ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{row.technique ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="text-muted-foreground text-sm">
          Page {page} of {totalPages || 1}
        </div>
        <nav className="flex items-center gap-2" aria-label="Pagination">
          {hasPrev ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard?page=${page - 1}`}>Previous</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>Previous</Button>
          )}
          {hasNext ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard?page=${page + 1}`}>Next</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>Next</Button>
          )}
        </nav>
      </div>
    </div>
  )
}
