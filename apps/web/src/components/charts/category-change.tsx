"use client";

import { Bar, BarChart, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { InsightsDTO } from "@fatura/shared";
import { formatCents, formatMonthName } from "@/lib/format";
import { ChartCard, DataTable, LegendKey } from "./chart-card";
import { ChartTooltip } from "./chart-tooltip";
import { useVizTheme } from "./viz-theme";

type Row = InsightsDTO["byCategory"][number] & { delta: number };

const ROW_HEIGHT = 32;

const signed = (cents: number) => `${cents > 0 ? "+" : cents < 0 ? "−" : ""}${formatCents(Math.abs(cents))}`;

/** Divergente: quanto cada categoria subiu (vermelho) ou caiu (azul) em relação ao mês anterior. */
export function CategoryChange({
  data,
  month,
  previousMonth,
}: {
  data: InsightsDTO["byCategory"];
  month: string;
  previousMonth: string;
}) {
  const theme = useVizTheme();
  const rows: Row[] = data
    .map((c) => ({ ...c, delta: c.cents - c.previousCents }))
    .filter((c) => c.delta !== 0)
    .sort((a, b) => b.delta - a.delta);
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.delta)), 1);

  return (
    <ChartCard
      title="O que mudou"
      subtitle={`Diferença por categoria entre ${formatMonthName(month)} e ${formatMonthName(previousMonth)}`}
      legend={
        <>
          <LegendKey color={theme.increase} label="Gastou mais" />
          <LegendKey color={theme.decrease} label="Gastou menos" />
        </>
      }
      table={
        <DataTable
          head={["Categoria", formatMonthName(previousMonth), formatMonthName(month), "Diferença"]}
          rows={rows.map((r) => [r.name, formatCents(r.previousCents), formatCents(r.cents), signed(r.delta)])}
        />
      }
    >
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhuma categoria mudou de valor.</p>
      ) : (
        <ResponsiveContainer width="100%" height={rows.length * ROW_HEIGHT + 8}>
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }} barCategoryGap={8}>
            {/* Domínio simétrico (zero no centro, lados comparáveis) com folga para os rótulos nas pontas. */}
            <XAxis type="number" hide domain={[-maxAbs * 1.6, maxAbs * 1.6]} />
            <YAxis
              type="category"
              dataKey="name"
              width={128}
              tickLine={false}
              axisLine={false}
              tick={{ fill: theme.inkSecondary, fontSize: 13 }}
            />
            <ReferenceLine x={0} stroke={theme.axis} />
            <Tooltip
              cursor={{ fill: theme.grid, opacity: 0.5 }}
              content={({ active, payload }) => {
                const row = payload?.[0]?.payload as Row | undefined;
                if (!active || !row) return null;
                return (
                  <ChartTooltip
                    title={row.name}
                    rows={[
                      { label: "diferença", value: signed(row.delta) },
                      { label: formatMonthName(month), value: formatCents(row.cents) },
                      { label: formatMonthName(previousMonth), value: formatCents(row.previousCents) },
                    ]}
                  />
                );
              }}
            />
            <Bar dataKey="delta" barSize={16} radius={[0, 4, 4, 0]}>
              {rows.map((r) => (
                <Cell key={r.categoryId ?? "none"} fill={r.delta > 0 ? theme.increase : theme.decrease} />
              ))}
              <LabelList
                dataKey="delta"
                content={({ x, y, width, height, index }) => {
                  const row = rows[index ?? -1];
                  if (!row) return null;
                  // Rótulo na ponta da barra: à direita se subiu, à esquerda se caiu.
                  const end = Number(x) + Number(width);
                  const positive = row.delta > 0;
                  return (
                    <text
                      x={positive ? end + 8 : end - 8}
                      y={Number(y) + Number(height) / 2}
                      textAnchor={positive ? "start" : "end"}
                      dominantBaseline="central"
                      fontSize={12}
                      fontWeight={600}
                      fill={theme.ink}
                    >
                      {signed(row.delta)}
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
