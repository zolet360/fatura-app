"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ImportInvoiceResultDTO, InvoiceSummaryDTO } from "@fatura/shared";
import { ApiError, apiFetch } from "@/lib/api";
import { formatCents, formatDay, formatMonth } from "@/lib/format";

const importErrors: Record<string, string> = {
  NOT_A_PDF: "O arquivo não é um PDF.",
  PDF_PASSWORD_PROTECTED: "O PDF está protegido por senha. Envie a versão sem senha.",
  PDF_UNREADABLE: "Não foi possível ler esse PDF.",
  UNSUPPORTED_ISSUER: "Por enquanto só faturas da Nubank são suportadas.",
  INVOICE_CHECKSUM_MISMATCH:
    "Não conseguimos ler todas as transações dessa fatura com segurança, então nada foi salvo.",
  FST_REQ_FILE_TOO_LARGE: "Arquivo grande demais (máximo 10 MB).",
};

export function Invoices() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [invoices, setInvoices] = useState<InvoiceSummaryDTO[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<InvoiceSummaryDTO[]>("/invoices").then(setInvoices);
  }, []);

  async function upload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const result = await apiFetch<ImportInvoiceResultDTO>("/invoices/import", { method: "POST", body: form });
      router.push(`/faturas/${result.invoice.id}`);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (importErrors[err.code] ?? err.message)
          : "Falha ao enviar o arquivo. Tente de novo.",
      );
    } finally {
      // Sempre, inclusive no sucesso: o Next preserva o estado desta página ao navegar e voltar.
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Faturas</h1>
        <label
          className={`cursor-pointer rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 ${
            uploading ? "pointer-events-none opacity-60" : ""
          }`}
        >
          {uploading ? "Importando…" : "Importar PDF"}
          <input
            ref={input}
            type="file"
            accept="application/pdf"
            className="sr-only"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {invoices === null ? (
        <p className="text-sm text-zinc-500">Carregando…</p>
      ) : invoices.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Nenhuma fatura importada. Envie o PDF que a Nubank manda por e-mail.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {invoices.map((invoice) => (
            <li key={invoice.id}>
              <Link href={`/faturas/${invoice.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <div className="flex-1">
                  <p className="font-medium capitalize">{formatMonth(invoice.referenceMonth)}</p>
                  <p className="text-sm text-zinc-500">
                    Vence {formatDay(invoice.dueDate)} · {invoice.transactionCount} transações
                  </p>
                </div>
                <p className="text-right font-semibold tabular-nums">{formatCents(invoice.totalCents)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
