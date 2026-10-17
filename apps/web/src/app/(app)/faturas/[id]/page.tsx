import { Suspense } from "react";
import { InvoiceDetail } from "./invoice-detail";

export default function InvoicePage({ params }: PageProps<"/faturas/[id]">) {
  // Com Cache Components, params de rota dinâmica são dados de runtime: acesso dentro de Suspense.
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Carregando…</p>}>
      {params.then(({ id }) => (
        <InvoiceDetail id={id} />
      ))}
    </Suspense>
  );
}
