"use client";

import type { CategoryDTO } from "@fatura/shared";

const AUTOMATIC = "__automatic__";

// A lista aberta do select é desenhada pelo navegador; cores explícitas garantem contraste
// mesmo onde color-scheme não é respeitado nas opções.
const optionClass = "bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100";

interface Props {
  categories: CategoryDTO[];
  value: string | null;
  onChange: (categoryId: string | null) => void;
  /** Mostra a opção de voltar para a categoria automática (quando a atual foi escolhida à mão). */
  allowAutomatic?: boolean;
  disabled?: boolean;
  placeholder?: string;
  "aria-label"?: string;
}

export function CategorySelect({ categories, value, onChange, allowAutomatic, disabled, placeholder, ...rest }: Props) {
  const color = categories.find((c) => c.id === value)?.color;

  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className="size-2.5 shrink-0 rounded-full"
        style={{ background: color ?? "transparent", boxShadow: color ? undefined : "inset 0 0 0 1px #a1a1aa" }}
      />
      <select
        aria-label={rest["aria-label"]}
        disabled={disabled}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === AUTOMATIC ? null : e.target.value)}
        className={`max-w-44 cursor-pointer rounded-md border border-transparent bg-transparent py-1 pr-1 text-sm hover:border-zinc-300 focus:border-zinc-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:hover:border-zinc-700 ${
          value ? "" : "text-zinc-500"
        }`}
      >
        {!value && (
          <option value="" className={optionClass}>
            {placeholder ?? "Sem categoria"}
          </option>
        )}
        {categories.map((c) => (
          <option key={c.id} value={c.id} className={optionClass}>
            {c.name}
          </option>
        ))}
        {allowAutomatic && (
          <option value={AUTOMATIC} className={optionClass}>
            ↺ Voltar para automática
          </option>
        )}
      </select>
    </span>
  );
}
