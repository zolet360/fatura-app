"use client";

import { useEffect, useState } from "react";
import type { CategoryDTO } from "@fatura/shared";
import { apiFetch } from "./api";

// Categorias quase nunca mudam: uma busca por carregamento de página, compartilhada entre componentes.
let cache: Promise<CategoryDTO[]> | null = null;

export function useCategories(): CategoryDTO[] {
  const [categories, setCategories] = useState<CategoryDTO[]>([]);

  useEffect(() => {
    cache ??= apiFetch<CategoryDTO[]>("/categories").catch((error: unknown) => {
      cache = null;
      throw error;
    });
    void cache.then(setCategories);
  }, []);

  return categories;
}
