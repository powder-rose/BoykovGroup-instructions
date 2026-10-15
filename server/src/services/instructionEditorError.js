export class InstructionEditorError extends Error {
  constructor(message, { status = 400, code = 'INVALID_INSTRUCTION', cause } = {}) {
    super(message, cause ? { cause } : undefined);

    this.name = 'InstructionEditorError';
    this.status = status;
    this.code = code;
  }
}
