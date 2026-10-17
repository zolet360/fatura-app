"use client";

import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { InsightsDTO } from "@fatura/shared";
import { formatCents, formatPercent } from "@/lib/format";
import { ChartCard, DataTable } from "./chart-card";
import { ChartTooltip } from "./chart-tooltip";
import { useVizTheme } from "./viz-theme";

type Row = InsightsDTO["byCategory"][number] & { share: number };

const ROW_HEIGHT = 34;

/** Magnitude por categoria: uma série, uma cor; ordenado do maior para o menor. */
export function CategoryBars({ data, spentCents }: { data: InsightsDTO["byCategory"]; spentCents: number }) {
  const theme = useVizTheme();
  const rows: Row[] = data
    .filter((c) => c.cents > 0)
    .map((c) => ({ ...c, share: spentCents > 0 ? c.cents / spentCents : 0 }));

  return (
    <ChartCard
      title="Onde foi o dinheiro"
      subtitle="Gasto por categoria no mês"
      table={
        <DataTable
          head={["Categoria", "Valor", "% do mês", "Lançamentos"]}
          rows={rows.map((r) => [r.name, formatCents(r.cents), formatPercent(r.share), r.count])}
        />
      }
    >
      <ResponsiveContainer width="100%" height={rows.length * ROW_HEIGHT + 8}>
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 120, bottom: 0, left: 0 }} barCategoryGap={8}>
          <XAxis type="number" hide domain={[0, "dataMax"]} />
          <YAxis
            type="category"
            dataKey="name"
            width={128}
            tickLine={false}
            axisLine={false}
            tick={{ fill: theme.inkSecondary, fontSize: 13 }}
          />
          <Tooltip
            cursor={{ fill: theme.grid, opacity: 0.5 }}
            content={({ active, payload }) => {
              const row = payload?.[0]?.payload as Row | undefined;
              if (!active || !row) return null;
              return (
                <ChartTooltip
                  title={row.name}
                  rows={[
                    { label: "no mês", value: formatCents(row.cents) },
                    { label: "do total", value: formatPercent(row.share) },
                    { label: row.count === 1 ? "lançamento" : "lançamentos", value: String(row.count) },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="cents" fill={theme.accent} barSize={18} radius={[0, 4, 4, 0]} activeBar={{ fillOpacity: 0.8 }}>
            <LabelList
              dataKey="cents"
              position="right"
              offset={8}
              content={({ x, y, width, height, index }) => {
                const row = rows[index ?? -1];
                if (!row) return null;
                return (
                  <text
                    x={Number(x) + Number(width) + 8}
                    y={Number(y) + Number(height) / 2}
                    dominantBaseline="central"
                    fontSize={13}
                  >
                    <tspan fill={theme.ink} fontWeight={600}>
                      {formatCents(row.cents)}
                    </tspan>
                    <tspan fill={theme.muted} dx={6}>
                      {formatPercent(row.share)}
                    </tspan>
                  </text>
                );
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
