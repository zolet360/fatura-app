"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { PendingMerchantDTO, UserDTO } from "@fatura/shared";
import { apiFetch } from "@/lib/api";

const links = [
  { href: "/", label: "Início" },
  { href: "/faturas", label: "Faturas" },
  { href: "/revisar", label: "Revisar" },
];

export function AppHeader() {
  const pathname = usePathname();
  const [user, setUser] = useState<UserDTO | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    void apiFetch<UserDTO>("/auth/me").then(setUser);
  }, []);

  // O layout não remonta entre páginas: atualiza o contador a cada navegação
  // (importar fatura ou categorizar muda o número).
  useEffect(() => {
    void apiFetch<PendingMerchantDTO[]>("/categorization/pending").then((list) => setPendingCount(list.length));
  }, [pathname]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mx-auto flex h-14 max-w-4xl items-center gap-6 px-4">
        <Link href="/" className="font-semibold tracking-tight">
          Fatura
        </Link>
        <nav className="flex flex-1 gap-1 text-sm">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md px-3 py-1.5 ${
                isActive(link.href)
                  ? "bg-zinc-100 font-medium dark:bg-zinc-800"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              {link.label}
              {link.href === "/revisar" && pendingCount > 0 && (
                <span className="ml-1.5 rounded-full bg-violet-600 px-1.5 py-0.5 text-xs font-medium text-white tabular-nums">
                  {pendingCount}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <Link href="/conta" title="Minha conta" className="flex items-center gap-2 text-sm">
          {user?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar externo do Google, sem otimização
            <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" className="size-8 rounded-full" />
          ) : (
            <span className="size-8 rounded-full bg-zinc-200 dark:bg-zinc-700" />
          )}
        </Link>
      </div>
    </header>
  );
}
