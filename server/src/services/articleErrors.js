export class ArticleError extends Error {
  constructor(message, { status = 400, code = 'INVALID_ARTICLE', cause } = {}) {
    super(message, cause ? { cause } : undefined);

    this.name = 'ArticleError';
    this.status = status;
    this.code = code;
  }
}
