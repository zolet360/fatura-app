const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatCents(cents: number): string {
  return currency.format(cents / 100);
}

export function formatForeign(cents: number, code: string): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: code }).format(cents / 100);
}

const compactCurrency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Para eixos: R$ 1,2 mil. */
export function formatCentsCompact(cents: number): string {
  return compactCurrency.format(cents / 100);
}

export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

const SHORT_MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-10" → "out/26". */
export function formatMonthShort(referenceMonth: string): string {
  const [year, month] = referenceMonth.split("-");
  return `${SHORT_MONTHS[Number(month) - 1]}/${year!.slice(2)}`;
}

/** "2026-10" → "outubro". */
export function formatMonthName(referenceMonth: string): string {
  return formatMonth(referenceMonth).split(" de ")[0]!;
}

/** "2026-10-13" → "13/10/2026". Monta a data à mão para não sofrer com fuso horário. */
export function formatDay(isoDay: string, withYear = true): string {
  const [year, month, day] = isoDay.split("-");
  return withYear ? `${day}/${month}/${year}` : `${day}/${month}`;
}

/** "2026-10" → "outubro de 2026". */
export function formatMonth(referenceMonth: string): string {
  const [year, month] = referenceMonth.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, 15)).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
