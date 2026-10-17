"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CategoryDTO, InsightsDTO } from "@fatura/shared";
import { CategoryBars } from "@/components/charts/category-bars";
import { CategoryChange } from "@/components/charts/category-change";
import { CumulativeLine } from "@/components/charts/cumulative-line";
import { InstallmentsColumns } from "@/components/charts/installments-columns";
import { MonthlyColumns } from "@/components/charts/monthly-columns";
import { apiFetch } from "@/lib/api";
import { useCategories } from "@/lib/categories";
import { formatCents, formatMonth, formatMonthName, formatPercent } from "@/lib/format";

export function Home() {
  const categories = useCategories();
  const [month, setMonth] = useState<string | null>(null);
  const [insights, setInsights] = useState<InsightsDTO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void apiFetch<InsightsDTO>(`/insights${month ? `?month=${month}` : ""}`)
      .then((data) => {
        if (!cancelled) setInsights(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month]);

  function selectMonth(next: string) {
    setLoading(true);
    setMonth(next);
  }

  if (!insights) return <p className="text-sm text-zinc-500">Carregando…</p>;
  if (!insights.month) return <EmptyState />;

  const current = insights.month;
  const invoiceId = insights.months.find((m) => m.referenceMonth === current)?.invoiceId;

  return (
    <div className="space-y-6">
      {/* Filtro único acima de tudo: todos os números abaixo são do mesmo mês. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-zinc-500">
          Fatura de
          <select
            value={current}
            onChange={(e) => selectMonth(e.target.value)}
            className="cursor-pointer rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-base font-medium capitalize text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            {[...insights.months].reverse().map((m) => (
              <option key={m.referenceMonth} value={m.referenceMonth}>
                {formatMonth(m.referenceMonth)}
              </option>
            ))}
          </select>
        </label>
        {invoiceId && (
          <Link href={`/faturas/${invoiceId}`} className="text-sm font-medium text-violet-700 hover:underline dark:text-violet-400">
            Ver transações →
          </Link>
        )}
      </div>

      {/* Recarregando: mantém o conteúdo anterior esmaecido, sem piscar. */}
      <div className={`space-y-6 transition-opacity ${loading ? "opacity-50" : ""}`}>
        <Summary insights={insights} categories={categories} />

        <CategoryBars data={insights.byCategory} spentCents={insights.summary.spentCents} />

        <div className="grid gap-6 lg:grid-cols-2">
          <MonthlyColumns months={insights.months} selected={current} onSelect={selectMonth} />
          <CumulativeLine data={insights.dailyCumulative} month={current} previousMonth={insights.previousMonth} />
        </div>

        {insights.previousMonth && (
          <CategoryChange data={insights.byCategory} month={current} previousMonth={insights.previousMonth} />
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <TopMerchants insights={insights} categories={categories} />
          <InstallmentsColumns data={insights.futureInstallments} />
        </div>
      </div>
    </div>
  );
}

function Summary({ insights, categories }: { insights: InsightsDTO; categories: CategoryDTO[] }) {
  const { summary } = insights;
  const top = insights.byCategory.find((c) => c.cents > 0);
  const delta = summary.previousSpentCents !== null ? summary.spentCents - summary.previousSpentCents : null;

  return (
    <div className="grid gap-4 md:grid-cols-[1.4fr_1fr_1fr]">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500">Gasto no mês</p>
        <p className="mt-1 text-5xl font-semibold tracking-tight">{formatCents(summary.spentCents)}</p>
        {delta !== null && insights.previousMonth && (
          <Delta cents={delta} base={summary.previousSpentCents ?? 0} previousMonth={insights.previousMonth} />
        )}
      </div>
      <Tile
        label="Maior categoria"
        value={top ? top.name : "—"}
        detail={top ? `${formatCents(top.cents)} · ${formatPercent(top.cents / summary.spentCents)} do mês` : undefined}
        color={top?.categoryId ? categories.find((c) => c.id === top.categoryId)?.color : undefined}
      />
      <div className="grid gap-4">
        <Tile
          label="Compras"
          value={String(summary.purchaseCount)}
          detail={`ticket médio ${formatCents(summary.averageTicketCents)}`}
        />
        <Tile label="Parcelas nas próximas faturas" value={formatCents(summary.futureInstallmentsCents)} />
      </div>
    </div>
  );
}

/** Variação vs mês anterior: gastar mais é ruim (vermelho, ▲), gastar menos é bom (verde, ▼). Ícone + texto, nunca só cor. */
function Delta({ cents, base, previousMonth }: { cents: number; base: number; previousMonth: string }) {
  const name = formatMonthName(previousMonth);
  if (cents === 0) return <p className="mt-2 text-sm text-zinc-500">Igual a {name}</p>;

  const up = cents > 0;
  const percent = base > 0 ? ` (${up ? "+" : "−"}${formatPercent(Math.abs(cents) / base)})` : "";
  return (
    <p className={`mt-2 text-sm font-medium ${up ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
      <span aria-hidden>{up ? "▲" : "▼"}</span> {formatCents(Math.abs(cents))}
      {percent} {up ? "a mais" : "a menos"} que {name}
    </p>
  );
}

function Tile({ label, value, detail, color }: { label: string; value: string; detail?: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-1 flex items-center gap-2 text-2xl font-semibold">
        {color && <span aria-hidden className="size-3 rounded-full" style={{ background: color }} />}
        {value}
      </p>
      {detail && <p className="mt-1 text-sm text-zinc-500">{detail}</p>}
    </div>
  );
}

function TopMerchants({ insights, categories }: { insights: InsightsDTO; categories: CategoryDTO[] }) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="font-medium">Onde você mais gastou</h2>
      <p className="mt-0.5 text-sm text-zinc-500">Estabelecimentos do mês, somando todas as compras</p>
      <table className="mt-4 w-full text-sm">
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {insights.topMerchants.map((m, i) => {
            const category = m.categoryId ? byId.get(m.categoryId) : undefined;
            return (
              <tr key={m.merchantKey}>
                <td className="w-6 py-2 text-zinc-400 tabular-nums">{i + 1}</td>
                <td className="py-2">
                  <p className="font-medium">{m.description}</p>
                  <p className="flex items-center gap-1.5 text-xs text-zinc-500">
                    <span
                      aria-hidden
                      className="size-2 rounded-full"
                      style={{ background: category?.color ?? "transparent", boxShadow: category ? undefined : "inset 0 0 0 1px #a1a1aa" }}
                    />
                    {category?.name ?? "Sem categoria"} · {m.count} {m.count === 1 ? "compra" : "compras"}
                  </p>
                </td>
                <td className="py-2 text-right font-medium tabular-nums">{formatCents(m.cents)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
      <h1 className="text-lg font-semibold">Nenhuma fatura ainda</h1>
      <p className="mt-2 text-sm text-zinc-500">Importe o PDF da sua fatura da Nubank para ver seus gastos aqui.</p>
      <Link
        href="/faturas"
        className="mt-6 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Importar fatura
      </Link>
    </div>
  );
}
