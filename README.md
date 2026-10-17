# Fatura

Organiza os gastos do cartão de crédito: lê o PDF da fatura (inicialmente Nubank), categoriza
as transações e mostra gráficos por categoria e por mês.

## Estrutura

```
apps/api         API em Fastify + Prisma (PostgreSQL)
  src/modules/<módulo>/
    domain/        entidades e contratos (portas), sem dependência de framework
    application/   casos de uso
    infra/         implementações: Prisma, JWT, Google
    http/          rotas Fastify
  src/container.ts liga implementações aos casos de uso (composition root)
apps/web         Front em Next.js; /api/* é repassado para a API (mesma origem)
packages/shared  Tipos e schemas zod usados pelos dois lados
```

## Rodando localmente

Pré-requisitos: Node 24+ e PostgreSQL rodando em `localhost:5432`.

1. `npm install` na raiz.
2. Copie `apps/api/.env.example` para `apps/api/.env` e preencha (veja abaixo).
3. `npm run db:migrate -w api` e depois `npm run db:seed -w api`.
4. `npm run dev` na raiz: API em `127.0.0.1:3333`, site em http://localhost:3000.

### Login com Google

1. Em https://console.cloud.google.com crie um projeto.
2. **APIs e serviços → Tela de permissão OAuth**: tipo *Externo*, preencha nome e e-mail.
   Escopos: só `openid`, `email` e `profile` (não exigem verificação do Google).
3. **Credenciais → Criar credenciais → ID do cliente OAuth → Aplicativo da Web**:
   - Origens JavaScript autorizadas: `http://localhost:3000`
   - URIs de redirecionamento autorizados: `http://localhost:3000/api/auth/google/callback`
4. Copie o ID e a chave secreta para `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` em `apps/api/.env`.

## Autenticação

- Login via Google (OpenID Connect, Authorization Code + PKCE). O `id_token` tem a assinatura verificada.
- Access token: JWT de 15 min. Refresh token: aleatório, 30 dias deslizantes, guardado no banco só como hash.
- Rotação a cada refresh. Reapresentar um refresh token antigo encerra a sessão (detecção de roubo);
  dentro de 30 s após a rotação é tratado como corrida entre abas e não derruba nada.
- Tokens em cookies `httpOnly` + `SameSite=Lax`; requisições que alteram estado vindas de outra
  origem são recusadas. Cada login é uma sessão, que pode ser listada e encerrada.

## Importação de faturas

- `POST /api/invoices/import` recebe o PDF (multipart, campo `file`, até 10 MB).
- O texto é extraído com pdf.js (`unpdf`), reconstruindo as linhas pela posição na página;
  um parser por banco (hoje só `NubankInvoiceParser`) transforma as linhas em fatura + transações.
- A soma das transações de cada grupo (titular, pagamentos) precisa bater com o subtotal impresso;
  se não bater, nada é salvo. Reimportar o mesmo mês substitui a fatura anterior.
- O PDF original fica em `storage/uploads/<userId>/<sha256>.pdf` (fora do git).
- `npm test -w api` também roda o parser contra os PDFs que estiverem em `storage/`.

## Categorização

Cada transação ganha uma `merchantKey` (nome do estabelecimento normalizado: sem acento, sem prefixo
de intermediador como `Dl*` ou `Mp *`). A categoria é decidida nesta ordem:

1. IOF, juros e multas → "Tarifas e juros".
2. Regra do usuário para a `merchantKey` (criada na tela Revisar ou com "Usar sempre").
3. Regras padrão por palavra-chave (`modules/categorization/domain/system-rules.ts`).
4. Nada casou → fica sem categoria e aparece em Revisar.

A origem fica em `categorySource`. Escolha manual (`MANUAL`) nunca é sobrescrita automaticamente e
sobrevive à reimportação da fatura. Depois de mudar as regras padrão, rode
`npm run db:recategorize -w api` para reaplicá-las ao histórico.

## Testes

`npm test` na raiz.
