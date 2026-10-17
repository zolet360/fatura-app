/**
 * Regras padrão por palavra-chave, aplicadas quando o usuário não tem regra própria para o estabelecimento.
 *
 * Cada termo casa com o INÍCIO de uma palavra da chave normalizada (ver merchantKeyOf):
 * "FARMA" pega "FARMACIA" e "FARMA". Termos terminados em "\\b" exigem a palavra inteira
 * (ex: "BAR\\b" não pega "BARBEARIA"). A primeira regra que casar vence, então as mais
 * específicas vêm antes ("UBER EATS" antes de "UBER", "MERCADO LIVRE" antes de "MERCADO").
 */
const RULES: { category: string; terms: string[] }[] = [
  // Específicas que colidiriam com regras mais genéricas abaixo.
  { category: "alimentacao", terms: ["UBER EATS", "IFOOD", "IFD\\b", "RAPPI", "ZE DELIVERY"] },
  { category: "assinaturas", terms: ["MELIMAIS", "MELI\\b", "AMAZON PRIME", "AMAZONPRIME", "PRIME VIDEO"] },
  { category: "compras", terms: ["MERCADOLIVRE", "MERCADO LIVRE"] },

  {
    category: "assinaturas",
    terms: [
      "NETFLIX", "SPOTIFY", "YOUTUB", "GOOGLE ONE", "GOOGLE STORAGE", "APPLE COM BILL", "ITUNES", "ICLOUD",
      "DISNEY", "HBO", "MAX COM", "PARAMOUNT", "GLOBOPLAY", "CRUNCHYROLL", "DEEZER", "CHATGPT", "OPENAI",
      "ANTHROPIC", "CLAUDE AI", "MICROSOFT", "XBOX GAME PASS", "PLAYSTATION PLUS", "CANVA", "NOTION", "ADOBE",
      "DROPBOX", "DUOLINGO", "KINDLE UNLIMITED", "AUDIBLE", "TWITCH", "PATREON",
    ],
  },
  {
    category: "alimentacao",
    terms: [
      "RESTAURANTE", "REST\\b", "LANCHE", "LANCHONETE", "PASTEL", "PIZZA", "BURGER", "HAMBURG", "MCDONALD",
      "MC DONALD", "SUBWAY", "BOBS\\b", "OUTBACK", "SORVETE", "ACAI", "PADARIA", "PANIFICADORA", "CAFE\\b",
      "CAFETERIA", "STARBUCKS", "CHURRASC", "SUSHI", "TEMAKI", "BAR\\b", "BOTECO", "DOCERIA", "CONFEITARIA",
      "CACAU SHOW", "KOPENHAGEN", "SPOLETO", "HABIBS", "GIRAFFAS", "CHIQUINHO", "COCO BAMBU", "MADERO",
    ],
  },
  {
    category: "mercado",
    terms: [
      "SUPERMERCADO", "MERCADO\\b", "MERCEARIA", "ATACA", "HIPER", "CARREFOUR", "ASSAI", "PAO DE ACUCAR",
      "ANGELONI", "GIASSI", "BISTEK", "ZAFFARI", "SONDA", "HORTIFRUTI", "SACOLAO", "ACOUGUE", "ALIMENTOS\\b",
      "EMPORIO", "MINIMERCADO",
    ],
  },
  {
    category: "transporte",
    terms: [
      "UBER", "99APP", "99 APP", "99 POP", "99TAXI", "CABIFY", "POSTO", "SHELL", "IPIRANGA", "PETROBRAS",
      "COMBUSTIVE", "ESTACIONAMENTO", "ESTAPAR", "SEM PARAR", "CONECTCAR", "VELOE", "PEDAGIO", "METRO\\b",
      "BLABLACAR", "BUSER",
    ],
  },
  {
    category: "saude",
    terms: [
      "FARMA", "DROGA", "PAGUE MENOS", "PANVEL", "HOSPITAL", "CLINICA", "LABORATORIO", "ODONTO", "DENTISTA",
      "UNIMED", "HAPVIDA", "AMIL\\b", "OTICA", "PSICOLOG", "FISIOTERAP", "SMARTFIT", "SMART FIT", "GYMPASS",
      "WELLHUB", "TOTALPASS", "ACADEMIA",
    ],
  },
  {
    category: "lazer",
    terms: [
      "CINEMA", "CINEMARK", "CINEPOLIS", "INGRESSO", "SYMPLA", "EVENTIM", "STEAM", "NUUVEM", "ENEBA", "G2A\\b",
      "INSTANT GAMING", "PLAYSTATION",
      "PSN\\b", "XBOX", "NINTENDO", "EPIC GAMES", "RIOT", "BLIZZARD", "TEATRO", "BOLICHE",
    ],
  },
  {
    category: "educacao",
    terms: [
      "UDEMY", "ALURA", "COURSERA", "ROCKETSEAT", "ESCOLA", "COLEGIO", "FACULDADE", "UNIVERSIDADE", "CURSO",
      "LIVRARIA", "SARAIVA", "ESTANTE VIRTUAL",
    ],
  },
  {
    category: "viagem",
    terms: [
      "AIRBNB", "BOOKING", "HOTEL", "POUSADA", "LATAM", "GOL LINHAS", "AZUL LINHAS", "DECOLAR", "CVC\\b",
      "123MILHAS", "HURB", "SMILES", "LOCALIZA", "MOVIDA", "UNIDAS", "RODOVIARIA", "CLICKBUS",
    ],
  },
  {
    category: "casa",
    terms: [
      "LEROY MERLIN", "TELHANORTE", "MADEIRAMADEIRA", "MADEIRA MADEIRA", "TOK STOK", "CAMICADO", "MOBLY",
      "CONSTRUCAO", "FERRAGEN", "MATERIAIS DE",
    ],
  },
  {
    category: "servicos",
    terms: [
      "VIVO\\b", "CLARO\\b", "TIM\\b", "CORREIOS", "LAVANDERIA", "BARBEARIA", "BARBER", "SALAO", "CABELEIREIR",
      "ESTETICA", "PETZ", "COBASI", "PET SHOP", "PETSHOP", "VETERINAR", "SEGURO", "CARTORIO", "DETRAN",
    ],
  },
  {
    category: "compras",
    terms: [
      "AMAZON", "SHOPEE", "SHEIN", "ALIEXPRESS", "TIKTOK SHOP", "TEMU\\b", "MAGALU", "MAGAZINE LUIZA", "AMERICANAS", "CASAS BAHIA",
      "KABUM", "PONTO FRIO", "NETSHOES", "CENTAURO", "RENNER", "RIACHUELO", "ZARA", "HERING", "DECATHLON",
      "LOJA", "SHOPPING",
    ],
  },
];

function compile(term: string): RegExp {
  const wholeWord = term.endsWith("\\b");
  const literal = (wholeWord ? term.slice(0, -2) : term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^| )${literal}${wholeWord ? "(?= |$)" : ""}`);
}

const COMPILED = RULES.flatMap(({ category, terms }) => terms.map((term) => ({ category, regex: compile(term) })));

/** Slug da categoria sugerida pelas regras padrão, ou null se nenhuma casar. */
export function matchSystemRule(merchantKey: string): string | null {
  return COMPILED.find((rule) => rule.regex.test(merchantKey))?.category ?? null;
}

/** Categoria aplicada automaticamente a IOF, juros e multas. */
export const FEES_CATEGORY = "tarifas";
