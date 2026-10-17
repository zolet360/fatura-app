"use client";

import { useSearchParams } from "next/navigation";

const messages: Record<string, string> = {
  cancelled: "Login cancelado.",
  invalid_state: "A sessão de login expirou. Tente de novo.",
  email_not_verified: "Sua conta Google não tem o e-mail verificado.",
};

export function LoginError() {
  const error = useSearchParams().get("error");
  if (!error) return null;

  return (
    <p role="alert" className="mt-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
      {messages[error] ?? "Não foi possível entrar. Tente de novo."}
    </p>
  );
}
