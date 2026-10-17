import { NextResponse, type NextRequest } from "next/server";

// Checagem otimista: só olha se existem cookies de sessão, sem validar.
// Quem valida de verdade é a API em cada requisição; isto só evita renderizar
// páginas internas para quem claramente não está logado.
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("fa_access") || request.cookies.has("fa_refresh");
  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Tudo exceto a própria API, o login e arquivos estáticos.
  matcher: ["/((?!api|login|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)"],
};
