// Prefixos de intermediadores de pagamento que o banco põe antes do nome do estabelecimento
// ("Dl*Google Youtub", "Mp *Loja", "Ebn*Crunchyroll"). Não dizem nada sobre o gasto.
const PAYMENT_FACILITATOR_PREFIXES = [
  "DL", "MP", "EC", "EBN", "EBANX", "PG", "PAG", "PAGSEGURO", "SUMUP", "ADIQPLU", "IZ", "SQ", "PAYPAL", "HNA", "BPG",
];

const PREFIX = new RegExp(`^(?:${PAYMENT_FACILITATOR_PREFIXES.join("|")}) ?\\* ?`);

/**
 * Chave estável de um estabelecimento, usada para agrupar transações e casar regras:
 * maiúscula, sem acento, sem prefixo de intermediador, só letras/números separados por espaço.
 * "Dl*Google Youtub" → "GOOGLE YOUTUB"; "Estorno de Mp *Loja X" → "LOJA X".
 */
export function merchantKeyOf(description: string): string {
  let text = description
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .trim();

  // Estorno categoriza junto com a compra original.
  text = text.replace(/^ESTORNO (DE |DA |DO )?/, "");
  text = text.replace(PREFIX, "");

  return text
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}
