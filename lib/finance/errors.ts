/** Erro de regra de negócio do financeiro, já com o status HTTP e a mensagem para o usuário. */
export class FinanceError extends Error {
  constructor(
    public readonly status: 400 | 403 | 404 | 409,
    message: string
  ) {
    super(message)
    this.name = 'FinanceError'
  }
}

export const notFound = (what: string) => new FinanceError(404, `${what} não encontrado(a)`)
export const conflict = (message: string) => new FinanceError(409, message)
export const badRequest = (message: string) => new FinanceError(400, message)
