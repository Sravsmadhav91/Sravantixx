import { useQuery } from "convex/react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { api } from "@/convex/_generated/api.js";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty.tsx";
import { TrendingUp } from "lucide-react";

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

type Props = {
  fromDate: string;
  toDate: string;
};

export default function SalesVelocityChart({ fromDate, toDate }: Props) {
  const data = useQuery(api.reports.getSalesVelocity, { fromDate, toDate });

  if (data === undefined) return <Skeleton className="h-72 w-full" />;

  if (data.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><TrendingUp /></EmptyMedia>
          <EmptyTitle>No data in this period</EmptyTitle>
          <EmptyDescription>Bookings and collections will appear here.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.015 95)" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis
          yAxisId="left"
          tickFormatter={(v: number) => formatCompactInr(v)}
          tick={{ fontSize: 11 }}
          width={70}
        />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} width={30} />
        <Tooltip
          formatter={(value, name) => {
            if (name === "Bookings") return [Number(value ?? 0), name];
            return [INR.format(Number(value ?? 0)), name];
          }}
        />
        <Legend />
        <Bar yAxisId="left" dataKey="collectionAmount" name="Collections" fill="oklch(0.55 0.13 175)" radius={[3, 3, 0, 0]} />
        <Bar yAxisId="left" dataKey="bookingValue" name="Booking Value" fill="oklch(0.72 0.15 70)" radius={[3, 3, 0, 0]} />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="bookingCount"
          name="Bookings"
          stroke="oklch(0.62 0.17 20)"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
