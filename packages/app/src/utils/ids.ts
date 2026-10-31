// Generatori di identificativi condivisi (prima ripetuti in chessTreeStore, pgnImport, sanitize, cover, ChessDiagram)

/** 9 caratteri casuali in base 36 */
export const randomToken = (): string => Math.random().toString(36).slice(2, 11)

/** Id con timestamp: "move-1712345678901-k3j9x2a1b" */
export const newId = (prefix: string): string => `${prefix}-${Date.now()}-${randomToken()}`

/** Id con UUID (con ripiego se crypto.randomUUID non c'è): "dg_550e8400-e29b-41d4-..." */
export const newUuid = (prefix: string): string =>
  `${prefix}_${crypto.randomUUID?.() ?? randomToken() + Date.now().toString(36)}`
