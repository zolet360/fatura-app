import type { ApiErrorDTO } from "@fatura/shared";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

// Uma única renovação em andamento por aba: se várias requisições recebem 401 juntas,
// todas esperam o mesmo refresh em vez de cada uma girar o token.
let refreshing: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    const res = await fetch("/api/auth/refresh", { method: "POST" });
    if (res.ok) return true;
    // Outra aba renovou ao mesmo tempo: os cookies novos já chegaram, é só repetir a requisição.
    const body = (await res.json().catch(() => null)) as ApiErrorDTO | null;
    return body?.code === "REFRESH_RACE";
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/** fetch para a API com renovação automática da sessão; sem sessão válida, manda para o login. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const request = () => fetch(`/api${path}`, init);

  let res = await request();
  if (res.status === 401 && (await refreshSession())) res = await request();

  if (res.status === 401) {
    // Fora de componente não há router; recarregar a página também descarta o estado da sessão antiga.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login");
    throw new ApiError(401, "UNAUTHORIZED", "Sessão expirada");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiErrorDTO | null;
    throw new ApiError(res.status, body?.code ?? "UNKNOWN", body?.message ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
