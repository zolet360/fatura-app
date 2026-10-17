// Erros de aplicação. A camada HTTP traduz cada um para o status correspondente;
// casos de uso nunca conhecem HTTP.

export class AppError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Não autenticado", code = "UNAUTHORIZED") {
    super(message, code);
  }
}

/** A requisição está bem formada, mas o conteúdo não pôde ser processado (ex: PDF ilegível). */
export class UnprocessableError extends AppError {}

export class NotFoundError extends AppError {
  constructor(message = "Recurso não encontrado", code = "NOT_FOUND") {
    super(message, code);
  }
}
