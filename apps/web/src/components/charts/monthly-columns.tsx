"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { InsightsDTO } from "@fatura/shared";
import { formatCents, formatCentsCompact, formatMonth, formatMonthShort } from "@/lib/format";
import { ChartCard, DataTable } from "./chart-card";
import { ChartTooltip } from "./chart-tooltip";
import { useVizTheme } from "./viz-theme";

const MAX_MONTHS = 12;

/** Ênfase: o mês selecionado na cor de destaque, os demais em cinza de contexto. Clicar seleciona. */
export function MonthlyColumns({
  months,
  selected,
  onSelect,
}: {
  months: InsightsDTO["months"];
  selected: string;
  onSelect: (month: string) => void;
}) {
  const theme = useVizTheme();
  const data = months.slice(-MAX_MONTHS);

  return (
    <ChartCard
      title="Mês a mês"
      subtitle="Gasto de cada fatura. Clique numa coluna para ver aquele mês."
      table={
        <DataTable
          head={["Mês", "Gasto"]}
          rows={data.map((m) => [formatMonth(m.referenceMonth), formatCents(m.spentCents)])}
        />
      }
    >
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 24, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid vertical={false} stroke={theme.grid} />
          <XAxis
            dataKey="referenceMonth"
            tickFormatter={formatMonthShort}
            tickLine={false}
            axisLine={{ stroke: theme.axis }}
            tick={{ fill: theme.muted, fontSize: 12 }}
          />
          <YAxis
            tickFormatter={formatCentsCompact}
            tickLine={false}
            axisLine={false}
            width={72}
            tick={{ fill: theme.muted, fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: theme.grid, opacity: 0.5 }}
            content={({ active, payload }) => {
              const row = payload?.[0]?.payload as InsightsDTO["months"][number] | undefined;
              if (!active || !row) return null;
              return <ChartTooltip title={formatMonth(row.referenceMonth)} rows={[{ label: "gasto", value: formatCents(row.spentCents) }]} />;
            }}
          />
          <Bar
            dataKey="spentCents"
            barSize={24}
            radius={[4, 4, 0, 0]}
            className="cursor-pointer"
            onClick={(entry) => onSelect((entry.payload as InsightsDTO["months"][number]).referenceMonth)}
          >
            {data.map((m) => (
              <Cell key={m.referenceMonth} fill={m.referenceMonth === selected ? theme.accent : theme.context} />
            ))}
            {/* Valor só no mês selecionado; os outros ficam no eixo e no tooltip. */}
            <LabelList
              dataKey="spentCents"
              position="top"
              content={({ x, y, width, index }) => {
                const row = data[index ?? -1];
                if (!row || row.referenceMonth !== selected) return null;
                return (
                  <text x={Number(x) + Number(width) / 2} y={Number(y) - 8} textAnchor="middle" fontSize={12} fontWeight={600} fill={theme.ink}>
                    {formatCentsCompact(row.spentCents)}
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
