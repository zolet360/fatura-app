import type { NextConfig } from "next";

const apiUrl = process.env.API_URL ?? "http://127.0.0.1:3333";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // O pacote compartilhado é publicado como código-fonte TypeScript.
  transpilePackages: ["@fatura/shared"],
  // O navegador só fala com o Next; /api/* é repassado para a API. Mesma origem = cookies
  // httpOnly funcionam sem CORS e o callback do Google também passa por aqui.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
