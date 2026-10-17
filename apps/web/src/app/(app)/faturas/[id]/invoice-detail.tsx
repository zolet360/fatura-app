"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type {
  CategoryDTO,
  InvoiceDetailDTO,
  TransactionCategoryDTO,
  TransactionDTO,
  TransactionKindDTO,
} from "@fatura/shared";
import { CategorySelect } from "@/components/category-select";
import { ApiError, apiFetch } from "@/lib/api";
import { useCategories } from "@/lib/categories";
import { formatCents, formatDay, formatForeign, formatMonth } from "@/lib/format";

const kindLabels: Record<TransactionKindDTO, { label: string; className: string } | null> = {
  PURCHASE: null,
  REFUND: { label: "estorno", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  IOF: { label: "IOF", className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  FEE: { label: "encargo", className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
  PAYMENT: { label: "pagamento", className: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300" },
};

/** Sugestão mostrada depois de mudar a categoria de uma transação: transformar em regra. */
interface RuleSuggestion {
  merchantKey: string;
  description: string;
  categoryId: string;
}

const json = (body: unknown): RequestInit => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export function InvoiceDetail({ id }: { id: string }) {
  const router = useRouter();
  const categories = useCategories();
  const [invoice, setInvoice] = useState<InvoiceDetailDTO | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [suggestion, setSuggestion] = useState<RuleSuggestion | null>(null);

  const load = () =>
    apiFetch<InvoiceDetailDTO>(`/invoices/${id}`).then(setInvoice, (err: unknown) => {
      if (err instanceof ApiError && err.status === 404) setNotFound(true);
    });

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega só quando muda a fatura
  }, [id]);

  async function remove() {
    if (!confirm("Excluir esta fatura e todas as transações dela?")) return;
    await apiFetch(`/invoices/${id}`, { method: "DELETE" });
    router.replace("/faturas");
  }

  async function changeCategory(transaction: TransactionDTO, categoryId: string | null) {
    const result = await apiFetch<TransactionCategoryDTO>(`/transactions/${transaction.id}/category`, {
      method: "PATCH",
      ...json({ categoryId }),
    });
    setInvoice((current) =>
      current && {
        ...current,
        transactions: current.transactions.map((t) => (t.id === transaction.id ? { ...t, ...result } : t)),
      },
    );
    setSuggestion(
      categoryId && transaction.kind !== "IOF" && transaction.kind !== "FEE"
        ? { merchantKey: transaction.merchantKey, description: transaction.description, categoryId }
        : null,
    );
  }

  async function applyAlways(rule: RuleSuggestion) {
    await apiFetch("/categorization/rules", { method: "POST", ...json(rule) });
    setSuggestion(null);
    await load();
  }

  if (notFound) {
    return (
      <p className="text-sm text-zinc-500">
        Fatura não encontrada. <Link href="/faturas" className="underline">Voltar</Link>
      </p>
    );
  }
  if (!invoice) return <p className="text-sm text-zinc-500">Carregando…</p>;

  const spending = invoice.transactions.filter((t) => t.kind !== "PAYMENT");
  const payments = invoice.transactions.filter((t) => t.kind === "PAYMENT");
  const uncategorized = spending.filter((t) => !t.categoryId).length;
  const suggestedCategory = suggestion && categories.find((c) => c.id === suggestion.categoryId);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/faturas" className="text-sm text-zinc-500 hover:underline">← Faturas</Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold capitalize">{formatMonth(invoice.referenceMonth)}</h1>
            <p className="text-sm text-zinc-500">
              {formatDay(invoice.periodStart)} a {formatDay(invoice.periodEnd)} · vence {formatDay(invoice.dueDate)}
            </p>
          </div>
          <button onClick={remove} className="text-sm text-red-600 hover:underline dark:text-red-400">
            Excluir fatura
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Total a pagar" value={formatCents(invoice.totalCents)} />
        <Stat label="Gasto no período" value={formatCents(invoice.spentCents)} />
        <Stat label="Transações" value={String(spending.length)} />
      </div>

      {uncategorized > 0 && (
        <p className="text-sm text-zinc-500">
          {uncategorized} {uncategorized === 1 ? "gasto sem categoria" : "gastos sem categoria"}.{" "}
          <Link href="/revisar" className="font-medium text-violet-700 hover:underline dark:text-violet-400">
            Revisar por estabelecimento →
          </Link>
        </p>
      )}

      {suggestion && suggestedCategory && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 rounded-lg bg-violet-50 px-4 py-3 text-sm text-violet-900 dark:bg-violet-950 dark:text-violet-200"
        >
          <span className="flex-1">
            Alterado só nesta compra. Usar <strong>{suggestedCategory.name}</strong> sempre para{" "}
            <strong>{suggestion.description}</strong>?
          </span>
          <button
            onClick={() => void applyAlways(suggestion)}
            className="rounded-md bg-violet-700 px-3 py-1.5 font-medium text-white hover:bg-violet-600"
          >
            Usar sempre
          </button>
          <button onClick={() => setSuggestion(null)} className="px-2 py-1.5 hover:underline">
            Só esta
          </button>
        </div>
      )}

      <TransactionTable
        title="Gastos"
        transactions={spending}
        categories={categories}
        onCategoryChange={(t, categoryId) => void changeCategory(t, categoryId)}
      />
      {payments.length > 0 && <TransactionTable title="Pagamentos" transactions={payments} />}
    </div>
  );
}

function TransactionTable({
  title,
  transactions,
  categories,
  onCategoryChange,
}: {
  title: string;
  transactions: TransactionDTO[];
  categories?: CategoryDTO[];
  onCategoryChange?: (transaction: TransactionDTO, categoryId: string | null) => void;
}) {
  return (
    <section>
      <h2 className="mb-3 font-medium">{title}</h2>
      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr className="border-b border-zinc-100 dark:border-zinc-800">
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 font-medium">Descrição</th>
              {onCategoryChange && <th className="px-4 py-3 font-medium">Categoria</th>}
              <th className="px-4 py-3 text-right font-medium">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {transactions.map((t) => {
              const badge = kindLabels[t.kind];
              return (
                <tr key={t.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-500 tabular-nums">{formatDay(t.date, false)}</td>
                  <td className="px-4 py-3">
                    <span>{t.description}</span>
                    {t.installment && (
                      <span className="ml-2 text-xs text-zinc-500">
                        parcela {t.installment.current}/{t.installment.total}
                      </span>
                    )}
                    {badge && (
                      <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${badge.className}`}>{badge.label}</span>
                    )}
                    {t.foreign && (
                      <span className="block text-xs text-zinc-500">
                        {formatForeign(t.foreign.amountCents, t.foreign.currency)}
                      </span>
                    )}
                  </td>
                  {onCategoryChange && categories && (
                    <td className="whitespace-nowrap px-4 py-2">
                      <CategorySelect
                        aria-label={`Categoria de ${t.description}`}
                        categories={categories}
                        value={t.categoryId}
                        allowAutomatic={t.categorySource === "MANUAL"}
                        onChange={(categoryId) => onCategoryChange(t, categoryId)}
                      />
                    </td>
                  )}
                  <td
                    className={`whitespace-nowrap px-4 py-3 text-right tabular-nums ${
                      t.amountCents < 0 ? "text-emerald-700 dark:text-emerald-400" : ""
                    }`}
                  >
                    {formatCents(t.amountCents)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
