"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { InsightsDTO } from "@fatura/shared";
import { formatCents, formatCentsCompact, formatMonthName } from "@/lib/format";
import { ChartCard, DataTable, LegendKey } from "./chart-card";
import { ChartTooltip } from "./chart-tooltip";
import { useVizTheme } from "./viz-theme";

interface Point {
  day: number;
  current?: number;
  previous?: number;
}

/** Ritmo de gastos: acumulado por dia do ciclo, mês atual em destaque e anterior como referência. */
export function CumulativeLine({
  data,
  month,
  previousMonth,
}: {
  data: InsightsDTO["dailyCumulative"];
  month: string;
  previousMonth: string | null;
}) {
  const theme = useVizTheme();
  const days = Math.max(data.current.length, data.previous?.length ?? 0);
  const points: Point[] = Array.from({ length: days }, (_, i) => ({
    day: i + 1,
    current: data.current[i],
    previous: data.previous?.[i],
  }));
  const currentName = formatMonthName(month);
  const previousName = previousMonth ? formatMonthName(previousMonth) : null;

  // Tabela semanal: dia a dia seria comprido demais para ler.
  const tableDays = points.filter((p) => p.day % 7 === 0 || p.day === days);

  return (
    <ChartCard
      title="Ritmo de gastos"
      subtitle="Quanto já tinha sido gasto em cada dia do ciclo da fatura"
      legend={
        <>
          <LegendKey shape="line" color={theme.accent} label={currentName} />
          {previousName && <LegendKey shape="line" color={theme.muted} label={previousName} />}
        </>
      }
      table={
        <DataTable
          head={["Dia do ciclo", currentName, ...(previousName ? [previousName] : [])]}
          rows={tableDays.map((p) => [
            `dia ${p.day}`,
            p.current !== undefined ? formatCents(p.current) : "—",
            ...(previousName ? [p.previous !== undefined ? formatCents(p.previous) : "—"] : []),
          ])}
        />
      }
    >
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
          <CartesianGrid vertical={false} stroke={theme.grid} />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={{ stroke: theme.axis }}
            tick={{ fill: theme.muted, fontSize: 12 }}
            ticks={[1, 8, 15, 22, 29].filter((d) => d <= days)}
            tickFormatter={(d: number) => `dia ${d}`}
          />
          <YAxis
            tickFormatter={formatCentsCompact}
            tickLine={false}
            axisLine={false}
            width={72}
            tick={{ fill: theme.muted, fontSize: 12 }}
          />
          <Tooltip
            cursor={{ stroke: theme.axis, strokeWidth: 1 }}
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as Point | undefined;
              if (!active || !point) return null;
              return (
                <ChartTooltip
                  title={`Dia ${point.day} do ciclo`}
                  rows={[
                    ...(point.current !== undefined
                      ? [{ label: currentName, value: formatCents(point.current), color: theme.accent }]
                      : []),
                    ...(previousName && point.previous !== undefined
                      ? [{ label: previousName, value: formatCents(point.previous), color: theme.muted }]
                      : []),
                  ]}
                />
              );
            }}
          />
          {previousName && (
            <Line
              dataKey="previous"
              stroke={theme.muted}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: theme.muted, stroke: theme.surface, strokeWidth: 2 }}
              isAnimationActive={false}
            />
          )}
          <Line
            dataKey="current"
            stroke={theme.accent}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={false}
            activeDot={{ r: 4, fill: theme.accent, stroke: theme.surface, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
