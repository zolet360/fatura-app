"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SessionDTO, UserDTO } from "@fatura/shared";
import { apiFetch } from "@/lib/api";

const fetchSessions = () => apiFetch<SessionDTO[]>("/auth/sessions");

export function Account() {
  const router = useRouter();
  const [user, setUser] = useState<UserDTO | null>(null);
  const [sessions, setSessions] = useState<SessionDTO[]>([]);

  useEffect(() => {
    void apiFetch<UserDTO>("/auth/me").then(setUser);
    void fetchSessions().then(setSessions);
  }, []);

  async function logout() {
    await apiFetch("/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  async function revoke(id: string) {
    await apiFetch(`/auth/sessions/${id}`, { method: "DELETE" });
    setSessions(await fetchSessions());
  }

  if (!user) return <p className="text-sm text-zinc-500">Carregando…</p>;

  return (
    <div className="space-y-8">
      <header className="flex items-center gap-4">
        {user.avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- avatar externo do Google, sem otimização
          <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" className="size-12 rounded-full" />
        )}
        <div className="flex-1">
          <h1 className="text-xl font-semibold">{user.name ?? user.email}</h1>
          <p className="text-sm text-zinc-500">{user.email}</p>
        </div>
        <button
          onClick={logout}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Sair
        </button>
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">Dispositivos conectados</h2>
        <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center gap-4 py-3 text-sm">
              <div className="flex-1">
                <p>
                  {describeUserAgent(s.userAgent)}
                  {s.current && (
                    <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      este dispositivo
                    </span>
                  )}
                </p>
                <p className="text-zinc-500">
                  {s.ip ?? "IP desconhecido"} · último uso {formatDate(s.lastUsedAt)}
                </p>
              </div>
              {!s.current && (
                <button onClick={() => revoke(s.id)} className="text-red-600 hover:underline dark:text-red-400">
                  Encerrar
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function describeUserAgent(ua: string | null): string {
  if (!ua) return "Dispositivo desconhecido";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Navegador";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} no ${os}` : browser;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
