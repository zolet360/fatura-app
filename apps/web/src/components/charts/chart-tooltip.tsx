/** Conteúdo de tooltip: valor em destaque, rótulo secundário, chave de série em traço. */
export function ChartTooltip({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: string; color?: string }[];
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm shadow-md dark:border-zinc-700 dark:bg-zinc-800">
      <p className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">{title}</p>
      {rows.map((row) => (
        <p key={row.label} className="flex items-center gap-2">
          {row.color && <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: row.color }} />}
          <span className="font-semibold tabular-nums">{row.value}</span>
          <span className="text-zinc-500 dark:text-zinc-400">{row.label}</span>
        </p>
      ))}
    </div>
  );
}
