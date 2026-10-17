"use client";

import { useSyncExternalStore } from "react";

const TOKENS = {
  surface: "--viz-surface",
  ink: "--viz-ink",
  inkSecondary: "--viz-ink-secondary",
  muted: "--viz-muted",
  grid: "--viz-grid",
  axis: "--viz-axis",
  accent: "--viz-accent",
  context: "--viz-context",
  increase: "--viz-increase",
  decrease: "--viz-decrease",
} as const;

export type VizTheme = Record<keyof typeof TOKENS, string>;

const LIGHT: VizTheme = {
  surface: "#ffffff",
  ink: "#0b0b0b",
  inkSecondary: "#52514e",
  muted: "#898781",
  grid: "#e1e0d9",
  axis: "#c3c2b7",
  accent: "#2a78d6",
  context: "#c3c2b7",
  increase: "#e34948",
  decrease: "#2a78d6",
};

let cached: { key: string; theme: VizTheme } | null = null;

function read(): VizTheme {
  const style = getComputedStyle(document.documentElement);
  const theme = Object.fromEntries(
    Object.entries(TOKENS).map(([name, token]) => [name, style.getPropertyValue(token).trim() || LIGHT[name as keyof VizTheme]]),
  ) as VizTheme;
  // Mesmo objeto enquanto os valores não mudam, como o useSyncExternalStore exige.
  const key = Object.values(theme).join();
  if (cached?.key !== key) cached = { key, theme };
  return cached.theme;
}

function subscribe(onChange: () => void) {
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Cores dos gráficos no tema atual. SVG não resolve var(--x) em atributos de forma confiável,
 * então lemos os tokens do CSS e passamos valores prontos; troca junto com o tema do sistema.
 */
export function useVizTheme(): VizTheme {
  return useSyncExternalStore(subscribe, read, () => LIGHT);
}
