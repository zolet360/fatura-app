"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { InsightsDTO } from "@fatura/shared";
import { formatCents, formatCentsCompact, formatMonth, formatMonthShort } from "@/lib/format";
import { ChartCard, DataTable } from "./chart-card";
import { ChartTooltip } from "./chart-tooltip";
import { useVizTheme } from "./viz-theme";

/** Parcelas de compras já feitas que vão cair nas próximas faturas. */
export function InstallmentsColumns({ data }: { data: InsightsDTO["futureInstallments"] }) {
  const theme = useVizTheme();

  return (
    <ChartCard
      title="Parcelas a vencer"
      subtitle="Quanto das próximas faturas já está comprometido com compras parceladas"
      table={
        data.length > 0 && (
          <DataTable head={["Fatura", "Parcelas"]} rows={data.map((d) => [formatMonth(d.month), formatCents(d.cents)])} />
        )
      }
    >
      {data.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhuma parcela pendente para os próximos meses.</p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 24, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid vertical={false} stroke={theme.grid} />
            <XAxis
              dataKey="month"
              tickFormatter={formatMonthShort}
              tickLine={false}
              axisLine={{ stroke: theme.axis }}
              tick={{ fill: theme.muted, fontSize: 12 }}
            />
            <YAxis hide />
            <Tooltip
              cursor={{ fill: theme.grid, opacity: 0.5 }}
              content={({ active, payload }) => {
                const row = payload?.[0]?.payload as InsightsDTO["futureInstallments"][number] | undefined;
                if (!active || !row) return null;
                return <ChartTooltip title={`Fatura de ${formatMonth(row.month)}`} rows={[{ label: "em parcelas", value: formatCents(row.cents) }]} />;
              }}
            />
            <Bar dataKey="cents" fill={theme.accent} barSize={24} radius={[4, 4, 0, 0]} activeBar={{ fillOpacity: 0.8 }}>
              <LabelList
                dataKey="cents"
                content={({ x, y, width, index }) => {
                  const row = data[index ?? -1];
                  if (!row) return null;
                  return (
                    <text x={Number(x) + Number(width) / 2} y={Number(y) - 8} textAnchor="middle" fontSize={12} fontWeight={600} fill={theme.ink}>
                      {formatCentsCompact(row.cents)}
                    </text>
                  );
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
