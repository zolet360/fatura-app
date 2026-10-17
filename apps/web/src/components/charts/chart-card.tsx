import type { ReactNode } from "react";

/** Card padrão de gráfico: título, subtítulo e a tabela equivalente (acessível sem hover). */
export function ChartCard({
  title,
  subtitle,
  legend,
  table,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  legend?: ReactNode;
  table?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="font-medium">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p>}
      {legend && <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">{legend}</div>}
      <div className="mt-4">{children}</div>
      {table && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer select-none text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
            Ver tabela
          </summary>
          <div className="mt-2 overflow-x-auto">{table}</div>
        </details>
      )}
    </section>
  );
}

export function LegendKey({ color, label, shape = "rect" }: { color: string; label: string; shape?: "rect" | "line" }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className={shape === "line" ? "h-0.5 w-4 rounded-full" : "size-2.5 rounded-sm"}
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

/** Tabela simples usada como "Ver tabela" de cada gráfico. */
export function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full text-sm tabular-nums">
      <thead>
        <tr className="text-left text-xs text-zinc-500">
          {head.map((h, i) => (
            <th key={h} className={`py-1.5 pr-4 font-medium ${i > 0 ? "text-right" : ""}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {rows.map((row, r) => (
          <tr key={r}>
            {row.map((cell, i) => (
              <td key={i} className={`py-1.5 pr-4 ${i > 0 ? "text-right" : ""}`}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
