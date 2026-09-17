import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { api } from "@/convex/_generated/api.js";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty.tsx";
import { Users, ArrowUpRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { cn } from "@/lib/utils.ts";
import * as XLSX from "xlsx";

export default function TopBuyersTable() {
  const data = useQuery(api.reports.getTopBuyers, { limit: 10 });

  if (data === undefined) return <Skeleton className="h-48 w-full" />;

  if (data.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><Users /></EmptyMedia>
          <EmptyTitle>No buyer data yet</EmptyTitle>
          <EmptyDescription>Book units to see top buyers here.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const handleExport = () => {
    const rows = data.map((r, i) => ({
      Rank: i + 1,
      Name: r.name,
      Phone: r.phone,
      "Bookings": r.bookingCount,
      "Total Booking Value": r.totalBookingValue,
      "Total Collected": r.totalCollected,
      "Outstanding": r.outstanding,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Top Buyers");
    XLSX.writeFile(wb, "top-buyers.xlsx");
  };

  const maxValue = data[0]?.totalBookingValue ?? 1;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="secondary" size="sm" onClick={handleExport}>
          <Download className="size-4" /> Export Excel
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-xs font-medium text-muted-foreground uppercase">
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Buyer</th>
              <th className="px-3 py-2 text-right">Bookings</th>
              <th className="px-3 py-2 text-right">Booking Value</th>
              <th className="px-3 py-2 text-right">Collected</th>
              <th className="px-3 py-2 text-right">Outstanding</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.map((r, i) => {
              const barPct = Math.round((r.totalBookingValue / maxValue) * 100);
              return (
                <tr key={r.buyerId}>
                  <td className="px-3 py-2.5 text-muted-foreground tabular-nums font-medium w-8">{i + 1}</td>
                  <td className="px-3 py-2.5">
                    <div className="space-y-1">
                      <p className="font-medium">{r.name}</p>
                      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{r.bookingCount}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{formatCompactInr(r.totalBookingValue)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-primary">{formatCompactInr(r.totalCollected)}</td>
                  <td className={cn("px-3 py-2.5 text-right tabular-nums", r.outstanding > 0 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
                    {formatCompactInr(r.outstanding)}
                  </td>
                  <td className="px-3 py-2.5">
                    <Link to={`/buyers/${r.buyerId}`} className="text-primary hover:underline text-xs flex items-center gap-0.5">
                      View <ArrowUpRight className="size-3" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
