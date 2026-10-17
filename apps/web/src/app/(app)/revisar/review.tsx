"use client";

import { useEffect, useState } from "react";
import type { PendingMerchantDTO } from "@fatura/shared";
import { CategorySelect } from "@/components/category-select";
import { apiFetch } from "@/lib/api";
import { useCategories } from "@/lib/categories";
import { formatCents, formatDay } from "@/lib/format";

export function Review() {
  const categories = useCategories();
  const [pending, setPending] = useState<PendingMerchantDTO[] | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<PendingMerchantDTO[]>("/categorization/pending").then(setPending);
  }, []);

  async function categorize(merchant: PendingMerchantDTO, categoryId: string | null) {
    if (!categoryId) return;
    setSaving(merchant.merchantKey);
    try {
      const { updated } = await apiFetch<{ updated: number }>("/categorization/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchantKey: merchant.merchantKey, categoryId }),
      });
      const name = categories.find((c) => c.id === categoryId)?.name;
      setNotice(`${merchant.description} → ${name}: ${updated} ${updated === 1 ? "transação" : "transações"}. Vale também para as próximas faturas.`);
      setPending((list) => list?.filter((p) => p.merchantKey !== merchant.merchantKey) ?? null);
    } finally {
      setSaving(null);
    }
  }

  if (!pending) return <p className="text-sm text-zinc-500">Carregando…</p>;

  const totalCents = pending.reduce((sum, p) => sum + p.totalCents, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Revisar categorias</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {pending.length === 0
            ? "Todos os gastos estão categorizados."
            : `${pending.length} ${pending.length === 1 ? "estabelecimento" : "estabelecimentos"} sem categoria, somando ${formatCents(totalCents)}. A escolha vale para todas as compras do lugar, inclusive nas próximas faturas.`}
        </p>
      </div>

      {notice && (
        <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          {notice}
        </p>
      )}

      {pending.length > 0 && (
        <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {pending.map((merchant) => (
            <li key={merchant.merchantKey} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{merchant.description}</p>
                <p className="text-sm text-zinc-500">
                  {merchant.count} {merchant.count === 1 ? "compra" : "compras"} · última em {formatDay(merchant.lastDate)}
                </p>
              </div>
              <p className="w-28 text-right font-medium tabular-nums">{formatCents(merchant.totalCents)}</p>
              <div className="w-48">
                <CategorySelect
                  aria-label={`Categoria de ${merchant.description}`}
                  categories={categories}
                  value={null}
                  placeholder="Escolher categoria…"
                  disabled={saving === merchant.merchantKey}
                  onChange={(categoryId) => void categorize(merchant, categoryId)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
